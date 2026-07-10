const fs = require('node:fs/promises');
const path = require('node:path');

const LOG_FILE = "C:\\Users\\StepronTech138\\.gemini\\antigravity-ide\\brain\\bdb92519-f87c-40e6-884b-b0b7dfc6657c\\.system_generated\\tasks\\task-248.log";
const BASE_URL = "http://localhost:3001";

// Simple cookie parser helper
function getCookie(headers, name) {
  const setCookies = headers.getSetCookie();
  for (const cookie of setCookies) {
    const parts = cookie.split(';')[0].split('=');
    if (parts[0] === name) {
      return parts[1];
    }
  }
  return null;
}

async function run() {
  console.log("=== STARTING E2E PROGRAMMATIC VERIFICATION ===");

  // 1. Admin login
  console.log("\n[1] Logging in as admin...");
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: "admin@stepron.com",
      password: "2BN-Admin-2026!"
    })
  });
  if (!adminLoginRes.ok) {
    throw new Error(`Admin login failed: ${adminLoginRes.statusText}`);
  }
  const adminToken = getCookie(adminLoginRes.headers, 'access_token');
  console.log(`Admin login success. Token length: ${adminToken.length}`);

  // 2. Fetch available themes
  console.log("\n[2] Fetching style themes...");
  const themesRes = await fetch(`${BASE_URL}/api/themes`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const themesData = await themesRes.json();
  const farmhouseTheme = themesData.themes.find(t => t.name.toLowerCase() === 'farmhouse');
  if (!farmhouseTheme) {
    throw new Error("Farmhouse theme not found in database.");
  }
  console.log(`Found Farmhouse theme: ID = ${farmhouseTheme.id}`);

  // 3. Create a project
  console.log("\n[3] Creating project with Farmhouse theme and Bob invited as secondary spouse...");
  const createProjectRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: "E2E Verification House",
      clientName: "E2E Homeowner",
      address: "789 E2E Road",
      themeId: farmhouseTheme.id,
      requiresDualApproval: true,
      secondaryHomeownerEmail: "bob@example.com"
    })
  });
  if (!createProjectRes.ok) {
    const errText = await createProjectRes.text();
    throw new Error(`Project creation failed: ${errText}`);
  }
  const projectData = await createProjectRes.json();
  const projectId = projectData.project.id;
  console.log(`Project created successfully. ID = ${projectId}`);

  // 4. Invite primary homeowner (Alice)
  console.log("\n[4] Inviting Alice as primary homeowner...");
  const inviteAliceRes = await fetch(`${BASE_URL}/api/projects/${projectId}/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      email: "alice@example.com",
      role: "primary_homeowner"
    })
  });
  if (!inviteAliceRes.ok) {
    const errText = await inviteAliceRes.text();
    throw new Error(`Alice invite failed: ${errText}`);
  }
  console.log("Alice invited successfully.");

  // Wait for emails to be sent and logged
  console.log("Waiting 2 seconds for server logs to write magic links...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 5. Parse magic link tokens from server logs
  console.log("\n[5] Parsing magic link tokens from server logs...");
  const logContent = await fs.readFile(LOG_FILE, 'utf-8');
  
  // Find lines with alice@example.com and the next lines containing token
  const aliceMatches = [...logContent.matchAll(/To:\s*alice@example\.com[\s\S]*?token=([a-f0-9]{64})/g)];
  const bobMatches = [...logContent.matchAll(/To:\s*bob@example\.com[\s\S]*?token=([a-f0-9]{64})/g)];

  if (aliceMatches.length === 0) {
    throw new Error("Could not find Alice's magic token in log file.");
  }
  if (bobMatches.length === 0) {
    throw new Error("Could not find Bob's magic token in log file.");
  }

  const aliceTokenUrl = aliceMatches[aliceMatches.length - 1][1];
  const bobTokenUrl = bobMatches[bobMatches.length - 1][1];
  console.log(`Extracted Alice invite token: ${aliceTokenUrl}`);
  console.log(`Extracted Bob invite token: ${bobTokenUrl}`);

  // 6. Log in as Alice
  console.log("\n[6] Logging in as Alice via magic link...");
  const aliceVerifyRes = await fetch(`${BASE_URL}/api/auth/magic-link/verify?token=${aliceTokenUrl}`);
  if (!aliceVerifyRes.ok) {
    const err = await aliceVerifyRes.text();
    throw new Error(`Alice verification failed: ${err}`);
  }
  const aliceAccessToken = getCookie(aliceVerifyRes.headers, 'access_token');
  console.log(`Alice authenticated. Access token length: ${aliceAccessToken.length}`);

  // 7. Log in as Bob
  console.log("\n[7] Logging in as Bob via magic link...");
  const bobVerifyRes = await fetch(`${BASE_URL}/api/auth/magic-link/verify?token=${bobTokenUrl}`);
  if (!bobVerifyRes.ok) {
    const err = await bobVerifyRes.text();
    throw new Error(`Bob verification failed: ${err}`);
  }
  const bobAccessToken = getCookie(bobVerifyRes.headers, 'access_token');
  console.log(`Bob authenticated. Access token length: ${bobAccessToken.length}`);

  // 8. Make selections and verify auto-save works as Alice
  console.log("\n[8] Making product selection choice as Alice (exercising auto-save)...");
  // Fetch Library items to find products for Kitchen Appliances (e.g. Level 1 or 2)
  const libRes = await fetch(`${BASE_URL}/api/library?projectId=${projectId}`);
  const libData = await libRes.json();
  const kitchenApplianceItem = libData.items.find(item => item.categoryKey === 'kitchen-appliances');
  if (!kitchenApplianceItem) {
    throw new Error("No kitchen appliance library items found.");
  }
  console.log(`Found kitchen appliance item: ${kitchenApplianceItem.manufacturer} ${kitchenApplianceItem.product} ($${kitchenApplianceItem.priceMin})`);

  // Patch selection to 'confirmed'
  const patchRes = await fetch(`${BASE_URL}/api/projects/${projectId}/selections`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aliceAccessToken}`
    },
    body: JSON.stringify({
      categoryKey: "kitchen-appliances",
      state: "confirmed",
      libraryItemId: kitchenApplianceItem.id
    })
  });
  if (!patchRes.ok) {
    const err = await patchRes.text();
    throw new Error(`Failed to confirm selection: ${err}`);
  }
  const selectionData = await patchRes.json();
  console.log("Selection successfully confirmed. Auto-save completed on server.");

  // Verify the project's lastVisitedCategoryKey is updated
  const projectDetailRes = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
    headers: { 'Authorization': `Bearer ${aliceAccessToken}` }
  });
  const projectDetail = await projectDetailRes.json();
  console.log(`Project lastVisitedCategoryKey: ${projectDetail.project.lastVisitedCategoryKey} (Expected: kitchen-appliances)`);
  if (projectDetail.project.lastVisitedCategoryKey !== 'kitchen-appliances') {
    throw new Error("Auto-save did not correctly update lastVisitedCategoryKey.");
  }

  // 9. Draft a Change Order as Builder (admin)
  console.log("\n[9] Drafting a Change Order for $1,000 delta...");
  const draftCoRes = await fetch(`${BASE_URL}/api/projects/${projectId}/change-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      title: "Upgraded Gold Accent Oven Range",
      notes: "Client requested upgrade to gold trim edition.",
      lines: [
        {
          category: "Kitchen - Appliances",
          description: "Upgrade from Standard Range to Gold Accent Trim Range",
          previousAmount: 1500,
          newAmount: 2500
        }
      ]
    })
  });
  if (!draftCoRes.ok) {
    const err = await draftCoRes.text();
    throw new Error(`Failed to draft change order: ${err}`);
  }
  const coData = await draftCoRes.json();
  const changeOrderId = coData.changeOrder.id;
  console.log(`Change order drafted successfully. ID = ${changeOrderId}, Status = ${coData.changeOrder.status}`);

  // 10. Release the Change Order
  console.log("\n[10] Releasing the Change Order...");
  const releaseRes = await fetch(`${BASE_URL}/api/projects/${projectId}/change-orders/${changeOrderId}/release`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (!releaseRes.ok) {
    const err = await releaseRes.text();
    throw new Error(`Failed to release change order: ${err}`);
  }
  const releaseData = await releaseRes.json();
  console.log(`Change order released. Status = ${releaseData.changeOrder.status}`);

  // Wait for release logs containing approval link to write
  console.log("Waiting 2 seconds for server logs to write the approval magic link...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 11. Parse approval token from server logs
  console.log("\n[11] Parsing approval link token from server logs...");
  const logContent2 = await fs.readFile(LOG_FILE, 'utf-8');
  // Match link structure: /approve/co?token=...&id=...
  const coTokenMatches = [...logContent2.matchAll(/approve\/co\?token=([a-f0-9]{64})&id=/g)];
  if (coTokenMatches.length === 0) {
    throw new Error("Could not find change order approval token in log file.");
  }
  const approvalToken = coTokenMatches[coTokenMatches.length - 1][1];
  console.log(`Extracted CO approval token: ${approvalToken}`);

  // 12. Verify Change Order details via GET verify route
  console.log("\n[12] Verifying Change Order details via public verify endpoint...");
  const verifyCoRes = await fetch(`${BASE_URL}/api/change-orders/verify?token=${approvalToken}&id=${changeOrderId}`);
  if (!verifyCoRes.ok) {
    const err = await verifyCoRes.text();
    throw new Error(`Failed to verify change order: ${err}`);
  }
  const verifiedData = await verifyCoRes.json();
  console.log(`Verified CO Number: ${verifiedData.changeOrder.number}`);
  console.log(`Verified CO Title: ${verifiedData.changeOrder.title}`);
  console.log(`Verified CO Status: ${verifiedData.changeOrder.status}`);
  console.log(`Required approvals count: ${verifiedData.changeOrder.requiredApprovals}`);

  // 13. Alice approves the Change Order
  console.log("\n[13] Alice (primary homeowner) signs the Change Order...");
  const aliceApproveRes = await fetch(
    `${BASE_URL}/api/change-orders/approve?token=${approvalToken}&id=${changeOrderId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aliceAccessToken}`
      },
      body: JSON.stringify({
        signatureType: "both",
        typedName: "Alice Primary",
        signatureImageBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        geoLatitude: 37.7749,
        geoLongitude: -122.4194,
        geoConsent: true
      })
    }
  );
  if (!aliceApproveRes.ok) {
    const err = await aliceApproveRes.text();
    throw new Error(`Alice approval failed: ${err}`);
  }
  const aliceApproveData = await aliceApproveRes.json();
  console.log(`Alice approval success. Status = ${aliceApproveData.status}, Approvals = ${aliceApproveData.approvalCount}/${aliceApproveData.requiredApprovals}`);
  if (aliceApproveData.status !== 'released') {
    throw new Error(`Expected change order status to be 'released' (pending secondary spouse), got '${aliceApproveData.status}'`);
  }

  // 14. Bob approves the Change Order
  console.log("\n[14] Bob (secondary homeowner) signs the Change Order...");
  const bobApproveRes = await fetch(
    `${BASE_URL}/api/change-orders/approve?token=${approvalToken}&id=${changeOrderId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bobAccessToken}`
      },
      body: JSON.stringify({
        signatureType: "drawn",
        signatureImageBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        geoLatitude: 37.7750,
        geoLongitude: -122.4195,
        geoConsent: true
      })
    }
  );
  if (!bobApproveRes.ok) {
    const err = await bobApproveRes.text();
    throw new Error(`Bob approval failed: ${err}`);
  }
  const bobApproveData = await bobApproveRes.json();
  console.log(`Bob approval success. Status = ${bobApproveData.status}, Approvals = ${bobApproveData.approvalCount}/${bobApproveData.requiredApprovals}`);
  if (bobApproveData.status !== 'approved') {
    throw new Error(`Expected change order status to be 'approved' after both spouses sign, got '${bobApproveData.status}'`);
  }

  // 15. Verify Project Budget updates correctly
  console.log("\n[15] Checking that project budget has updated...");
  const finalProjectRes = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const finalProject = (await finalProjectRes.json()).project;
  console.log(`Initial/Base Budget: $${finalProject.baseBudget}`);
  console.log(`Current Budget (updated): $${finalProject.currentBudget}`);
  if (finalProject.currentBudget !== finalProject.baseBudget + 1000) {
    throw new Error(`Budget update incorrect. Expected ${finalProject.baseBudget + 1000}, got ${finalProject.currentBudget}`);
  }

  // 16. Verify PDF exists
  console.log("\n[16] Verifying PDF file generated on disk...");
  // PDF file path format on server: path.join(env.uploadsDir, 'pdfs', `co-${changeOrder.projectId}-${changeOrder.number}.pdf`)
  const pdfFileName = `co-${projectId}-1.pdf`;
  const pdfPath = path.join(__dirname, '../uploads/pdfs', pdfFileName);
  try {
    const stats = await fs.stat(pdfPath);
    console.log(`PDF successfully generated: ${pdfPath} (Size: ${stats.size} bytes)`);
  } catch (err) {
    throw new Error(`PDF file not found at ${pdfPath}: ${err.message}`);
  }

  console.log("\n=== E2E VERIFICATION COMPLETED SUCCESSFULLY! ALL PASSED ===");
}

run().catch(err => {
  console.error("\n*** VERIFICATION FAILED ***");
  console.error(err);
  process.exit(1);
});
