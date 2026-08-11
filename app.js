/**
 * Application Logic for Revenue Officer Knowledge Base & AI Tutor
 * Ultra-Smart Semantic NLP Engine + In-App Direct Official Statute Viewer Modal
 */

let currentTopicId = KNOWLEDGE_BASE[0].id;
let isDarkMode = localStorage.getItem("theme") === "dark";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Theme
  if (isDarkMode) {
    document.documentElement.setAttribute("data-theme", "dark");
    updateThemeIcon(true);
  }

  // Initial Render
  renderSidebarMenu();
  renderArticle(currentTopicId);
  setupEventListeners();
  setupStatuteModalListeners();
  setupResponsive();
  loadUserNotes();

  // Load API Key if saved
  const savedKey = localStorage.getItem("gemini_api_key");
  if (savedKey) {
    const input = document.getElementById("geminiApiKeyInput");
    if (input) input.value = savedKey;
  }
});

// ชุดโจทย์แบบทดสอบ = entry ที่ id ขึ้นต้นด้วย quiz- (หมวดเนื้อหาจะไม่ใช้ prefix นี้)
function isQuizSet(topic) {
  return topic.id && topic.id.startsWith("quiz-");
}

// Render Sidebar Menu List — แยก 2 กลุ่มใหญ่ให้รู้ทันที: "เนื้อหา" vs "แบบทดสอบ"
// หัวกลุ่มคลิกย่อ/ขยายได้ (จำสถานะใน localStorage) — เวลาไปทำข้อสอบกดย่อกลุ่มเนื้อหาทิ้งได้ ไม่ต้องไถจอ
function renderSidebarMenu(filterQuery = "") {
  const menuContainer = document.getElementById("topicMenu");
  if (!menuContainer) return;
  menuContainer.innerHTML = "";

  const matches = (t) =>
    !filterQuery ||
    t.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
    t.summary.toLowerCase().includes(filterQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(filterQuery.toLowerCase());

  const contentTopics = [];
  const quizTopics = [];
  KNOWLEDGE_BASE.forEach((t) => {
    if (!matches(t)) return;
    (isQuizSet(t) ? quizTopics : contentTopics).push(t);
  });

  if (contentTopics.length === 0 && quizTopics.length === 0) {
    menuContainer.innerHTML = `<div style="padding: 20px; color: #64748b; font-size: 0.85rem; text-align: center;">ไม่พบหัวข้อที่ค้นหา</div>`;
    return;
  }

  // ขณะค้นหาให้ขยายทั้ง 2 กลุ่มเสมอ (กันมองไม่เห็นผลการค้นหา)
  const filterActive = !!filterQuery;

  if (contentTopics.length > 0) {
    menuContainer.appendChild(
      buildMenuGroup("book-open", "เนื้อหา (บทเรียน + ตัวบท)", contentTopics.length, "menu-group-header-content", "content", contentTopics, filterActive)
    );
  }

  if (quizTopics.length > 0) {
    menuContainer.appendChild(
      buildMenuGroup("edit", "แบบทดสอบ (ชุดโจทย์เก็งข้อสอบ)", quizTopics.length, "menu-group-header-quiz", "quiz", quizTopics, filterActive)
    );
  }
}

// สร้างกลุ่มเมนูที่คลิกหัวข้อเพื่อย่อ/ขยายได้
function buildMenuGroup(icon, label, count, cls, groupKey, topics, forceExpanded) {
  const group = document.createElement("div");
  group.className = "menu-group";

  const header = document.createElement("div");
  header.className = `menu-group-header ${cls}`;
  header.setAttribute("role", "button");
  header.setAttribute("tabindex", "0");
  header.setAttribute("aria-expanded", "true");
  header.innerHTML = `
    <div class="menu-group-title"><i class="fas fa-${icon}"></i> ${escapeHTML(label)}</div>
    <div class="menu-group-header-right">
      <span class="menu-group-count">${count}</span>
      <i class="fas fa-chevron-down menu-group-chevron"></i>
    </div>
  `;

  // สถานะย่อ/ขยาย: ครั้งแรกที่เข้า (ยังไม่เคยตั้งค่า) ให้ย่อกลุ่มเนื้อหาไว้ก่อน
  // กันไถจอจนถึงแบบทดสอบ — ครั้งต่อไปใช้สถานะที่ผู้ใช้เลือกเอง
  let collapsed = false;
  if (!forceExpanded) {
    const saved = localStorage.getItem("menu_collapsed_" + groupKey);
    collapsed = saved === null ? groupKey === "content" : saved === "1";
  }
  if (collapsed) {
    group.classList.add("collapsed");
    header.setAttribute("aria-expanded", "false");
  }

  const toggle = () => {
    // ขณะค้นหาให้หัวกลุ่มขยายค้างไว้เสมอ กันกดย่อแล้วมองไม่เห็นผลค้นหา
    if (forceExpanded) return;
    const nowCollapsed = group.classList.toggle("collapsed");
    header.setAttribute("aria-expanded", nowCollapsed ? "false" : "true");
    localStorage.setItem("menu_collapsed_" + groupKey, nowCollapsed ? "1" : "0");
  };
  header.addEventListener("click", toggle);
  header.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });

  const body = document.createElement("div");
  body.className = "menu-group-body";
  body.id = "menu-group-body-" + groupKey;
  header.setAttribute("aria-controls", body.id);
  appendCategoryGroup(body, topics);

  group.appendChild(header);
  group.appendChild(body);
  return group;
}

function appendCategoryGroup(menuContainer, topics) {
  const categories = {};
  topics.forEach((t) => {
    if (!categories[t.category]) categories[t.category] = [];
    categories[t.category].push(t);
  });

  for (const [catName, catTopics] of Object.entries(categories)) {
    const catLabel = document.createElement("div");
    catLabel.className = "menu-category-label";
    catLabel.textContent = catName;
    menuContainer.appendChild(catLabel);

    catTopics.forEach((t) => {
      const isQuiz = isQuizSet(t);
      const item = document.createElement("div");
      item.className = `topic-item ${t.id === currentTopicId ? "active" : ""}`;
      item.onclick = () => selectTopic(t.id);

      item.innerHTML = `
        <div class="topic-icon">
          <i class="fas ${t.categoryIcon || "fa-book-open"}"></i>
        </div>
        <div class="topic-info">
          <div class="topic-name">${escapeHTML(t.title)} <span class="topic-badge ${isQuiz ? "badge-quiz" : "badge-content"}">${isQuiz ? "แบบทดสอบ" : "เนื้อหา"}</span></div>
          <div class="topic-meta"><i class="far fa-clock"></i> ${t.readTime}</div>
        </div>
      `;
      menuContainer.appendChild(item);
    });
  }
}

// Select topic & view article
function selectTopic(topicId) {
  currentTopicId = topicId;
  const searchInput = document.getElementById("searchInput");
  renderSidebarMenu(searchInput ? searchInput.value : "");
  renderArticle(topicId);
  loadUserNotes();
  closeSidebar(); // mobile: ปิด drawer เมื่อเลือกหัวข้อแล้ว
}

// Render Article Content
function renderArticle(topicId) {
  const topic = KNOWLEDGE_BASE.find((t) => t.id === topicId);
  if (!topic) return;

  // Update Breadcrumb
  const bcCat = document.getElementById("breadcrumbCat");
  const bcTitle = document.getElementById("breadcrumbTitle");
  if (bcCat) bcCat.textContent = topic.category;
  if (bcTitle) bcTitle.textContent = topic.title;

  const container = document.getElementById("articleContainer");
  if (!container) return;

  let statutesHTML = "";
  if (topic.statutes && topic.statutes.length > 0) {
    statutesHTML = `
      <div style="margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px;">
        ${topic.statutes
          .map(
            (st, sIdx) => `
          <button class="law-viewer-btn" onclick="openStatuteModal('${topic.id}', ${sIdx})">
            <i class="fas fa-scroll"></i> อ่านตัวบทฉบับเต็ม ${escapeHTML(st.sectionNumber)}
          </button>
        `
          )
          .join("")}
      </div>
    `;
  }

  let sectionsHTML = topic.sections
    .map(
      (sec) => `
      <div class="section-card">
        <div class="section-heading"><i class="fas fa-bookmark"></i> ${sec.heading}</div>
        <div class="section-text">${sec.content}</div>
      </div>
    `
    )
    .join("");

  let keyLawsHTML = topic.keyLaws && topic.keyLaws.length > 0
    ? `
      <div class="law-box">
        <i class="fas fa-gavel"></i>
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted);">มาตรา/กฎหมายสำคัญที่ต้องท่องจำ:</div>
          <div class="law-text">${topic.keyLaws.join(", ")}</div>
        </div>
      </div>
    `
    : "";

  let quizHTML = "";
  if (topic.quiz && topic.quiz.length > 0) {
    quizHTML = `
      <div class="quiz-section">
        <div class="quiz-header">
          <div class="quiz-title"><i class="fas fa-edit" style="color:var(--primary-color)"></i> ลองทำโจทย์เก็งข้อสอบจริง (กฎหมายปัจจุบัน)</div>
          <span style="font-size:0.8rem; color:var(--text-muted);">${topic.quiz.length} ข้อ</span>
        </div>
        ${topic.quiz
          .map(
            (q, qIdx) => `
          <div class="quiz-card" id="quiz-card-${qIdx}">
            <div class="quiz-question">${qIdx + 1}. ${q.question}</div>
            <div class="quiz-options">
              ${q.options
                .map(
                  (opt, oIdx) => `
                <button class="option-btn" onclick="checkAnswer(${qIdx}, ${oIdx}, ${q.answer})">${opt}</button>
              `
                )
                .join("")}
            </div>
            <div class="quiz-explanation" id="quiz-exp-${qIdx}">
              <strong><i class="fas fa-lightbulb"></i> เฉลย:</strong> ${q.explanation}
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="article-header">
      <div class="article-tags">
        <span class="tag tag-cat">${topic.category}</span>
        <span class="tag tag-imp">ความสำคัญ: ${topic.importance}</span>
      </div>
      <h1 class="article-title">${topic.title}</h1>
      <p class="article-summary">${topic.summary}</p>
      ${statutesHTML}
    </div>
    ${keyLawsHTML}
    ${sectionsHTML}
    ${quizHTML}
  `;
}

// Open Statute Modal Viewer
window.openStatuteModal = function (topicId, statuteIdx) {
  const topic = KNOWLEDGE_BASE.find((t) => t.id === topicId);
  if (!topic || !topic.statutes || !topic.statutes[statuteIdx]) return;

  const st = topic.statutes[statuteIdx];
  const modal = document.getElementById("statuteModal");
  const modalTitle = document.getElementById("statuteModalTitle");
  const modalBody = document.getElementById("statuteModalBody");

  if (modalTitle) {
    modalTitle.innerHTML = `<i class="fas fa-scroll" style="color:#2dd4bf;"></i> <span>${escapeHTML(st.title)}</span>`;
  }
  if (modalBody) {
    modalBody.innerHTML = `<h3 style="color:var(--primary-color); font-family:var(--font-heading); margin-bottom:12px;">${escapeHTML(st.title)}</h3><div style="font-family:var(--font-body); font-size:0.95rem; line-height:1.8;">${escapeHTML(st.fullText).replace(/\n/g, "<br>")}</div>`;
  }

  if (modal) modal.style.display = "flex";
};

function setupStatuteModalListeners() {
  const modal = document.getElementById("statuteModal");
  const closeBtn = document.getElementById("closeStatuteModalBtn");
  const closeBottomBtn = document.getElementById("closeStatuteModalBottomBtn");

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }
  if (closeBottomBtn && modal) {
    closeBottomBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  }
}

// Check Quiz Answer
window.checkAnswer = function (qIdx, selectedOptIdx, correctOptIdx) {
  const card = document.getElementById(`quiz-card-${qIdx}`);
  if (!card) return;
  const buttons = card.querySelectorAll(".option-btn");
  const expDiv = document.getElementById(`quiz-exp-${qIdx}`);

  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === correctOptIdx) {
      btn.classList.add("correct");
    }
    if (idx === selectedOptIdx && selectedOptIdx !== correctOptIdx) {
      btn.classList.add("wrong");
    }
  });

  if (expDiv) expDiv.style.display = "block";
};

// Escape string helper
function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Event Listeners
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderSidebarMenu(e.target.value);
    });
  }

  // Theme Toggle
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      isDarkMode = !isDarkMode;
      document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
      localStorage.setItem("theme", isDarkMode ? "dark" : "light");
      updateThemeIcon(isDarkMode);
    });
  }

  // API Key Settings Toggle
  const apiKeyToggleBtn = document.getElementById("apiKeyToggleBtn");
  const apiKeyContainer = document.getElementById("apiKeyContainer");
  if (apiKeyToggleBtn && apiKeyContainer) {
    apiKeyToggleBtn.addEventListener("click", () => {
      apiKeyContainer.style.display = apiKeyContainer.style.display === "none" ? "block" : "none";
    });
  }

  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener("click", () => {
      const keyVal = document.getElementById("geminiApiKeyInput").value.trim();
      localStorage.setItem("gemini_api_key", keyVal);
      alert(keyVal ? "บันทึก Gemini API Key เรียบร้อยแล้ว! ระบบจะใช้ AI โมเดลจริงในการตอบคำถาม" : "ยกเลิกการใช้ API Key แล้ว (สลับเป็น Strict Knowledge Base RAG)");
      if (apiKeyContainer) apiKeyContainer.style.display = "none";
    });
  }

  // Notes Auto Save
  const notesArea = document.getElementById("topicNotes");
  if (notesArea) {
    notesArea.addEventListener("input", () => {
      localStorage.setItem(`note_${currentTopicId}`, notesArea.value);
    });
  }

  // AI Chat Toggle
  const aiDrawer = document.getElementById("aiChatDrawer");
  const fabAiBtn = document.getElementById("fabAiBtn");
  const closeChatBtn = document.getElementById("closeChatBtn");
  const askAiCurrentBtn = document.getElementById("askAiCurrentBtn");

  if (fabAiBtn && aiDrawer) {
    fabAiBtn.addEventListener("click", () => {
      aiDrawer.classList.toggle("open");
    });
  }
  if (closeChatBtn && aiDrawer) {
    closeChatBtn.addEventListener("click", () => {
      aiDrawer.classList.remove("open");
    });
  }
  if (askAiCurrentBtn && aiDrawer) {
    askAiCurrentBtn.addEventListener("click", () => {
      const topic = KNOWLEDGE_BASE.find((t) => t.id === currentTopicId);
      aiDrawer.classList.add("open");
      addChatMessage(`ช่วยสรุปประเด็นหลักและตัวบทมาตราของเรื่อง "${topic.title}" จากคลังความรู้ให้หน่อยครับ`, "user");
      simulateAiResponse(
        `📌 **สรุปข้อเท็จจริงตามประมวลรัษฎากร/กฎหมายในคลังความรู้:**\n\n• **เรื่อง:** ${topic.title}\n• **สาระสำคัญ:** ${topic.summary}\n• **มาตราอ้างอิง:** ${
          topic.keyLaws && topic.keyLaws.length > 0 ? topic.keyLaws.join(", ") : "ดูในบทเรียน"
        }\n\nคุณสามารถกดปุ่ม "อ่านตัวบทฉบับเต็ม" เพื่อเปิดดูตัวบทกฎหมายมาตรานั้นๆ ได้ทันทีเลยครับ!`
      );
    });
  }

  // Send Chat
  const sendBtn = document.getElementById("sendChatBtn");
  const chatInput = document.getElementById("chatInput");
  if (sendBtn) sendBtn.addEventListener("click", handleUserSendChat);
  if (chatInput) {
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleUserSendChat();
    });
  }
}

// Mobile responsive: off-canvas sidebar drawer toggle
function closeSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) sidebar.classList.remove("open");
  const backdrop = document.querySelector(".sidebar-backdrop");
  if (backdrop) backdrop.remove();
}

function setupResponsive() {
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const sidebar = document.querySelector(".sidebar");
  if (!hamburgerBtn || !sidebar) return;

  hamburgerBtn.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    let backdrop = document.querySelector(".sidebar-backdrop");
    if (isOpen && !backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "sidebar-backdrop";
      backdrop.addEventListener("click", closeSidebar);
      document.body.appendChild(backdrop);
    } else if (!isOpen && backdrop) {
      backdrop.remove();
    }
  });

  // ปิด drawer เมื่อย่อหน้าจอกลับมาเป็นขนาด desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeSidebar();
  });

  // ปิด drawer ด้วยปุ่ม ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });
}

function updateThemeIcon(dark) {
  const icon = document.getElementById("themeIcon");
  const text = document.getElementById("themeText");
  if (icon && text) {
    if (dark) {
      icon.className = "fas fa-sun";
      text.textContent = "โหมดสว่าง";
    } else {
      icon.className = "fas fa-moon";
      text.textContent = "โหมดมืด";
    }
  }
}

function loadUserNotes() {
  const notesArea = document.getElementById("topicNotes");
  if (notesArea) {
    const saved = localStorage.getItem(`note_${currentTopicId}`) || "";
    notesArea.value = saved;
  }
}

// Chat functions
async function handleUserSendChat() {
  const input = document.getElementById("chatInput");
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

  addChatMessage(msg, "user");
  input.value = "";

  const apiKey = localStorage.getItem("gemini_api_key");
  if (apiKey) {
    addChatMessage("<i>กำลังประมวลผลคำตอบจากคลังความรู้ด้วย Gemini AI...</i>", "bot-loading");
    try {
      const liveRes = await callGeminiApi(msg, apiKey);
      removeLoadingMsg();
      addChatMessage(liveRes, "bot");
    } catch (err) {
      removeLoadingMsg();
      addChatMessage("เกิดข้อผิดพลาดในการเรียกใช้ Gemini API (กำลังสลับเป็น Strict Knowledge Base RAG): " + err.message, "bot");
      const fallbackRes = generateSmartAiResponse(msg);
      addChatMessage(fallbackRes, "bot");
    }
  } else {
    // Strict Knowledge Base Grounding RAG
    setTimeout(() => {
      const response = generateSmartAiResponse(msg);
      addChatMessage(response, "bot");
    }, 400);
  }
}

function removeLoadingMsg() {
  const body = document.getElementById("chatBody");
  if (!body) return;
  const loadingMsg = body.querySelector(".bot-loading");
  if (loadingMsg) loadingMsg.remove();
}

function addChatMessage(text, sender) {
  const body = document.getElementById("chatBody");
  if (!body) return;
  const div = document.createElement("div");
  div.className = `chat-msg ${sender}`;
  div.innerHTML = sender === "user" ? escapeHTML(text).replace(/\n/g, "<br>") : text.replace(/\n/g, "<br>");
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function simulateAiResponse(text) {
  setTimeout(() => {
    addChatMessage(text, "bot");
  }, 400);
}

// Live Gemini API Integration with Strict Knowledge Base Context
async function callGeminiApi(userPrompt, apiKey) {
  const kbContext = KNOWLEDGE_BASE.map(t => {
    return `[หมวด: ${t.category} | เรื่อง: ${t.title}]\n${t.sections.map(s => s.heading + ': ' + s.content).join('\n')}`;
  }).join('\n\n');

  const contextPrompt = `คุณคือ AI ติวเตอร์เตรียมสอบนักวิชาการสรรพากร 
คำสั่งสำคัญ: ให้ตอบคำถามโดยอ้างอิงและใช้ความรู้จากบทบัญญัติแห่งประมวลรัษฎากรและกฎหมายในคลังความรู้นี้เท่านั้น โดยใช้ระบบลำดับภาษาไทย (ทวิ, ตรี, จัตวา, เบญจ) ห้ามนำกฎหมายเก่าที่ยกเลิกไปแล้วมาตอบเด็ดขาด

[คลังความรู้ประมวลรัษฎากรและกฎหมายสอบทั้งหมด]:
${kbContext}

คำถามจากผู้สมัครสอบ: ${userPrompt}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: contextPrompt }] }]
    })
  });

  const data = await res.json();
  if (data.candidates && data.candidates[0].content.parts[0].text) {
    return data.candidates[0].content.parts[0].text;
  }
  throw new Error("ไม่พบคำตอบจาก Gemini API");
}

// Strict Knowledge Base Grounding & Intent Recognition Engine
function generateSmartAiResponse(query) {
  const q = query.toLowerCase().trim();

  // Greeting
  if (q.includes("สวัสดี") || q.includes("ทักทาย") || q.includes("hello") || q.includes("hi")) {
    return "สวัสดีครับ! ผมคือ AI ติวเตอร์เตรียมสอบนักวิชาการสรรพากร (ระบบอ่านตัวบทกฎหมายฉบับเต็มในแอป) ผมถูกตั้งค่าให้อ้างอิงคำตอบจากตัวบทมาตราประมวลรัษฎากรและกฎหมายในคลังความรู้เท่านั้นครับ มีมาตราหรือเรื่องใดในคลังความรู้ที่อยากสอบถามไหมครับ?";
  }

  // INTENT: มาตรา 69 ทวิ / มาตรา 70
  if (q.includes("69") || q.includes("70")) {
    return `<strong>🏛️ สรุปสาระสำคัญ มาตรา 69 ทวิ และ มาตรา 70 แห่งประมวลรัษฎากร:</strong><br><br>
1. <strong>มาตรา 69 ทวิ (การหักภาษี ณ ที่จ่าย เมื่อรัฐจ่ายเงินให้นิติบุคคล):</strong><br>
   • <i>หมายเหตุ:</i> คำว่า "ทวิ" เป็นคำลำดับกฎหมายแทรก ลำดับที่ 2 ของไทย (ใช้เรียก มาตรา 69 ทวิ)<br>
   • <strong>หลักการ:</strong> เมื่อหน่วยงานรัฐ (รัฐบาล, รัฐวิสาหกิจ, เทศบาล, อบต./อบจ.) จ่ายเงินค่าสินค้า/บริการ ม.40(2)-(8) ตั้งแต่ <strong>500 บาทขึ้นไป</strong> ให้แก่บริษัทหรือห้างหุ้นส่วนนิติบุคคล<br>
   • <strong>อัตราภาษี:</strong> หน่วยงานรัฐมีหน้าที่ <strong>หักภาษี ณ ที่จ่าย 1% (1.0%)</strong> เสมอ<br><br>
2. <strong>มาตรา 70 (ภาษีหัก ณ ที่จ่าย นิติบุคคลต่างประเทศ):</strong><br>
   • <strong>หลักการ:</strong> เมื่อบริษัทต่างประเทศที่ไม่ได้ประกอบกิจการในไทย ได้รับเงินได้ ม.40(2)-(6) จากไทย<br>
   • <strong>อัตราภาษีหัก ณ ที่จ่าย:</strong><br>
     - <strong>เงินปันผล (ม.40(4)(ข)):</strong> หัก ณ ที่จ่าย <strong>10%</strong><br>
     - <strong>เงินได้อื่นๆ (ม.40(2),(3),(4)(ก),(5),(6) เช่น ค่าบริการ, ค่าลิขสิทธิ์, ดอกเบี้ย, ค่าเช่า):</strong> หัก ณ ที่จ่าย <strong>15%</strong>`;
  }

  // INTENT: อัตราภาษีก้าวหน้า / ม.48 คิดที่ขั้นเท่าไร
  if (q.includes("อัตราภาษีก้าวหน้า") || q.includes("ก้าวหน้า") || q.includes("ขั้นเท่าไร") || q.includes("คิดที่ขั้น")) {
    return `<strong>📊 ตารางอัตราภาษีเงินได้บุคคลธรรมดาแบบก้าวหน้า 7 ขั้น (ม.48(1) กฎหมายปัจจุบัน):</strong><br><br>
1. <strong>เงินได้สุทธิ 0 - 150,000 บาทแรก:</strong> ยกเว้นภาษี (0%)<br>
2. <strong>150,001 - 300,000 บาท:</strong> อัตรา 5% (ภาษีขั้นนี้สูงสุด 7,500 บาท)<br>
3. <strong>300,001 - 500,000 บาท:</strong> อัตรา 10% (ภาษีขั้นนี้สูงสุด 20,000 บาท / ภาษีสะสมสูงสุด 27,500 บาท)<br>
4. <strong>500,001 - 750,000 บาท:</strong> อัตรา 15% (ภาษีขั้นนี้สูงสุด 37,500 บาท / ภาษีสะสมสูงสุด 65,000 บาท)<br>
5. <strong>750,001 - 1,000,000 บาท:</strong> อัตรา 20% (ภาษีขั้นนี้สูงสุด 50,000 บาท / ภาษีสะสมสูงสุด 115,000 บาท)<br>
6. <strong>1,000,001 - 2,000,000 บาท:</strong> อัตรา 25% (ภาษีขั้นนี้สูงสุด 250,000 บาท / ภาษีสะสมสูงสุด 365,000 บาท)<br>
7. <strong>2,000,001 - 5,000,000 บาท:</strong> อัตรา 30% (ภาษีขั้นนี้สูงสุด 900,000 บาท / ภาษีสะสมสูงสุด 1,265,000 บาท)<br>
8. <strong>ส่วนที่เกิน 5,000,000 บาทขึ้นไป:</strong> อัตรา 35%<br><br>
💡 <i>อธิบายภาษาบ้านๆ:</i> ยิ่งมี "เงินได้สุทธิ" (รายได้ - ค่าใช้จ่าย - ค่าลดหย่อน) เหลือมากเท่าไร ส่วนที่เกินขึ้นไปจะถูกคิดอัตราแพงขึ้นเป็นขั้นๆ ครับ`;
  }

  // INTENT 1: 0.5% / วิธีที่ 2 / เกณฑ์ 5,000 บาท
  if (
    (q.includes("0.5%") || q.includes("0.5") || q.includes("วิธีที่ 2") || q.includes("วิธี 2")) &&
    (q.includes("5000") || q.includes("5,000") || q.includes("ไม่ถึง") || q.includes("เกิน") || q.includes("วิธีที่ 1") || q.includes("วิธี 1"))
  ) {
    return `<strong>ถูกต้องครับ! อ้างอิงตามประมวลรัษฎากร มาตรา 48(2):</strong><br><br>
1. หากคำนวณภาษีวิธีที่ 2 (0.5% ของเงินได้พึงประเมิน ม.40(2)-(8)) แล้วได้ยอดภาษี <strong>ไม่เกิน 5,000 บาท</strong> ผู้เสียภาษีจะได้รับการยกเว้นไม่ต้องเสียภาษีตามวิธีที่ 2<br>
2. ผู้เสียภาษีจะต้องกลับไปชำระภาษีตาม <strong>วิธีที่ 1 (คำนวณจากเงินได้สุทธิ อัตราก้าวหน้า)</strong> เพียงวิธีเดียวเท่านั้นครับ!`;
  }

  // STRICT RAG SEMANTIC RETRIEVAL SEARCH
  const matchedResult = searchKnowledgeBaseSemantic(query);
  if (matchedResult) {
    return matchedResult;
  }

  return `ขออภัยครับ คำถามนี้อยู่นอกเหนือขอบเขตประมวลรัษฎากรและกฎหมายเตรียมสอบที่บันทึกไว้ในคลังความรู้ ระบบ AI ถูกตั้งค่าให้อ้างอิงและตอบเฉพาะข้อมูลข้อเท็จจริงในคลังความรู้เท่านั้นครับ หากมีข้อสงสัยเกี่ยวกับมาตราประมวลรัษฎากร สามารถพิมพ์ถามเจาะจงได้เลยครับ`;
}

// Strict RAG Semantic Matcher across Knowledge Base
function searchKnowledgeBaseSemantic(userQuery) {
  const words = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return null;

  let bestMatch = null;
  let highestScore = 0;

  KNOWLEDGE_BASE.forEach(topic => {
    topic.sections.forEach(sec => {
      let score = 0;
      const textToSearch = (sec.heading + " " + sec.content).toLowerCase();
      words.forEach(w => {
        if (textToSearch.includes(w)) score += 1;
      });

      if (score > highestScore) {
        highestScore = score;
        bestMatch = { topic, sec };
      }
    });
  });

  if (bestMatch && highestScore >= 2) {
    return `<strong>📌 อ้างอิงข้อเท็จจริงจากเรื่อง "${bestMatch.topic.title}" ในคลังความรู้:</strong><br><br>
<strong>${bestMatch.sec.heading}</strong><br>${bestMatch.sec.content.replace(/\n/g, '<br>')}`;
  }

  return null;
}
