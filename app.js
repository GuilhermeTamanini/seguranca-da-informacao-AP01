const USERS = [
  {
    id: 1,
    name: "Ana Souza",
    email: "aluno@faculdade.local",
    password: "123456",
    role: "ALUNO"
  },
  {
    id: 2,
    name: "Prof. Carlos Lima",
    email: "professor@faculdade.local",
    password: "123456",
    role: "PROFESSOR"
  },
  {
    id: 3,
    name: "Administrador Geral",
    email: "admin@faculdade.local",
    password: "admin",
    role: "ADMIN"
  }
];

const STORAGE_KEYS = {
  session: "ocorrencias_sessao",
  occurrences: "ocorrencias_registros",
  audit: "ocorrencias_logs"
};

const SESSION_TIMEOUT = 15 * 60 * 1000;

const INITIAL_OCCURRENCES = [
  {
    id: "OC-1001",
    studentName: "Marina Alves",
    studentId: "202300145",
    studentCpf: "123.456.789-10",
    studentEmail: "marina.alves@email.local",
    studentPhone: "(47) 99999-1010",
    category: "Nota",
    priority: "Média",
    description: "Solicitação de revisão de nota.",
    internalNote: "Verificar coordenação.",
    status: "Aberta",
    createdBy: "professor@faculdade.local",
    createdAt: "2026-05-05T18:40:00.000Z"
  }
];

const loginView = document.querySelector("#loginView");
const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const occurrenceForm = document.querySelector("#occurrenceForm");
const logoutBtn = document.querySelector("#logoutBtn");
const exportBtn = document.querySelector("#exportBtn");
const clearLogsBtn = document.querySelector("#clearLogsBtn");
const resetBtn = document.querySelector("#resetBtn");
const searchInput = document.querySelector("#search");

const sessionBadge = document.querySelector("#sessionBadge");
const currentUserName = document.querySelector("#currentUserName");
const currentUserDetails = document.querySelector("#currentUserDetails");
const occurrencesTable = document.querySelector("#occurrencesTable");
const auditLog = document.querySelector("#auditLog");
const totalOccurrences = document.querySelector("#totalOccurrences");
const criticalOccurrences = document.querySelector("#criticalOccurrences");
const lastUpdate = document.querySelector("#lastUpdate");

function sanitize(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function maskCpf(cpf) {
  return cpf.replace(/\d(?=\d{2})/g, "*");
}

function isAdmin() {
  const session = getSession();
  return session && session.role === "ADMIN";
}

function isProfessor() {
  const session = getSession();
  return session && session.role === "PROFESSOR";
}

function canDelete() {
  return isAdmin();
}

function canExport() {
  return isAdmin();
}

function canViewLogs() {
  return isAdmin();
}

function boot() {
  if (!localStorage.getItem(STORAGE_KEYS.occurrences)) {
    localStorage.setItem(
      STORAGE_KEYS.occurrences,
      JSON.stringify(INITIAL_OCCURRENCES)
    );
  }

  if (!localStorage.getItem(STORAGE_KEYS.audit)) {
    localStorage.setItem(STORAGE_KEYS.audit, JSON.stringify([]));
  }

  const session = getSession();

  if (session) {
    const now = Date.now();

    if (now - session.lastActivity > SESSION_TIMEOUT) {
      logout();
      alert("Sessão encerrada por inatividade.");
      return;
    }

    session.lastActivity = now;
    saveSession(session);
    showApp(session);
  } else {
    showLogin();
  }
}

function getOccurrences() {
  return JSON.parse(
    localStorage.getItem(STORAGE_KEYS.occurrences) || "[]"
  );
}

function saveOccurrences(occurrences) {
  localStorage.setItem(
    STORAGE_KEYS.occurrences,
    JSON.stringify(occurrences)
  );
}

function getAuditLogs() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.audit) || "[]");
}

function saveAuditLogs(logs) {
  localStorage.setItem(STORAGE_KEYS.audit, JSON.stringify(logs));
}

function getSession() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
}

function saveSession(user) {
  user.lastActivity = Date.now();

  localStorage.setItem(
    STORAGE_KEYS.session,
    JSON.stringify(user)
  );
}

function writeLog(action, detail) {
  const session = getSession();
  const logs = getAuditLogs();

  logs.unshift({
    when: new Date().toISOString(),
    user: session ? session.email : "anonimo",
    role: session ? session.role : "SEM_SESSAO",
    action,
    detail
  });

  saveAuditLogs(logs);
}

function showLogin() {
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
  logoutBtn.classList.add("hidden");

  sessionBadge.textContent = "Sessão não iniciada";
  sessionBadge.classList.add("muted");
}

function showApp(user) {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");

  sessionBadge.textContent = `${user.name} — ${user.role}`;
  sessionBadge.classList.remove("muted");

  currentUserName.textContent = user.name;
  currentUserDetails.textContent =
    `${user.email} | Perfil: ${user.role}`;

  render();
}

function login(email, password) {
  const user = USERS.find(
    (item) =>
      item.email === email &&
      item.password === password
  );

  if (!user) {
    alert("Usuário ou senha inválidos.");
    writeLog("LOGIN_FALHOU", `Tentativa para ${email}`);
    return;
  }

  saveSession(user);

  writeLog(
    "LOGIN_OK",
    `Usuário ${user.email} entrou no sistema.`
  );

  showApp(user);
}

function logout() {
  const session = getSession();

  writeLog(
    "LOGOUT",
    session
      ? `${session.email} saiu do sistema.`
      : "Sessão encerrada."
  );

  localStorage.removeItem(STORAGE_KEYS.session);

  showLogin();
}

function validateOccurrence(data) {
  if (
    !data.studentName ||
    !data.studentId ||
    !data.studentCpf ||
    !data.description
  ) {
    alert("Preencha os campos obrigatórios.");
    return false;
  }

  if (!data.privacyAck) {
    alert("Confirme autorização dos dados.");
    return false;
  }

  return true;
}

function createOccurrence(event) {
  event.preventDefault();

  const session = getSession();

  if (!session) {
    alert("Sessão inválida.");
    return;
  }

  const occurrence = {
    id: `OC-${Math.floor(Math.random() * 9000) + 1000}`,
    studentName: sanitize(document.querySelector("#studentName").value),
    studentId: sanitize(document.querySelector("#studentId").value),
    studentCpf: sanitize(document.querySelector("#studentCpf").value),
    studentEmail: sanitize(document.querySelector("#studentEmail").value),
    studentPhone: sanitize(document.querySelector("#studentPhone").value),
    category: sanitize(document.querySelector("#category").value),
    priority: sanitize(document.querySelector("#priority").value),
    description: sanitize(document.querySelector("#description").value),
    internalNote: sanitize(document.querySelector("#internalNote").value),
    privacyAck: document.querySelector("#privacyAck").checked,
    status: "Aberta",
    createdBy: session.email,
    createdAt: new Date().toISOString()
  };

  if (!validateOccurrence(occurrence)) {
    return;
  }

  const occurrences = getOccurrences();

  occurrences.unshift(occurrence);

  saveOccurrences(occurrences);

  writeLog(
    "OCORRENCIA_CRIADA",
    `Ocorrência ${occurrence.id} criada.`
  );

  occurrenceForm.reset();

  render();
}

function deleteOccurrence(id) {
  if (!canDelete()) {
    alert("Acesso negado.");
    return;
  }

  const occurrences = getOccurrences();

  const updated = occurrences.filter(
    (item) => item.id !== id
  );

  saveOccurrences(updated);

  writeLog(
    "OCORRENCIA_EXCLUIDA",
    `Ocorrência ${id} excluída.`
  );

  render();
}

function changeStatus(id, status) {
  if (!isProfessor() && !isAdmin()) {
    alert("Acesso negado.");
    return;
  }

  const occurrences = getOccurrences();

  const occurrence = occurrences.find(
    (item) => item.id === id
  );

  if (!occurrence) {
    return;
  }

  occurrence.status = status;
  occurrence.updatedAt = new Date().toISOString();

  saveOccurrences(occurrences);

  writeLog(
    "STATUS_ALTERADO",
    `Ocorrência ${id} alterada para ${status}.`
  );

  render();
}

function exportEverything() {
  if (!canExport()) {
    alert("Somente administradores podem exportar.");
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    occurrences: getOccurrences(),
    audit: getAuditLogs()
  };

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    {
      type: "application/json"
    }
  );

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "backup-ocorrencias.json";
  anchor.click();

  URL.revokeObjectURL(url);

  writeLog(
    "EXPORTACAO_TOTAL",
    "Dados exportados."
  );
}

function clearLogs() {
  if (!isAdmin()) {
    alert("Acesso negado.");
    return;
  }

  saveAuditLogs([]);

  render();
}

function resetData() {
  if (!isAdmin()) {
    alert("Acesso negado.");
    return;
  }

  localStorage.setItem(
    STORAGE_KEYS.occurrences,
    JSON.stringify(INITIAL_OCCURRENCES)
  );

  localStorage.setItem(
    STORAGE_KEYS.audit,
    JSON.stringify([])
  );

  writeLog("RESET", "Sistema restaurado.");

  render();
}

function render() {
  const term = searchInput.value.toLowerCase();

  const occurrences = getOccurrences();

  const filtered = occurrences.filter((item) => {
    return JSON.stringify(item)
      .toLowerCase()
      .includes(term);
  });

  totalOccurrences.textContent =
    occurrences.length;

  criticalOccurrences.textContent =
    occurrences.filter(
      (item) => item.priority === "Crítica"
    ).length;

  lastUpdate.textContent =
    `Atualizado em ${new Date().toLocaleTimeString("pt-BR")}`;

  occurrencesTable.innerHTML = filtered
    .map((item) => `
      <tr>
        <td>
          <strong>${sanitize(item.studentName)}</strong><br />
          <span class="muted-text">${sanitize(item.studentId)}</span>
        </td>

        <td>${maskCpf(item.studentCpf)}</td>

        <td>
          ${sanitize(item.studentEmail)}<br />
          ${sanitize(item.studentPhone)}
        </td>

        <td>${sanitize(item.category)}</td>

        <td>
          <span class="priority ${sanitize(item.priority)}">
            ${sanitize(item.priority)}
          </span>
        </td>

        <td>${sanitize(item.status)}</td>

        <td>
          <strong>Descrição:</strong>
          ${sanitize(item.description)}
          <br />

          ${
            isAdmin()
              ? `
            <strong>Obs. interna:</strong>
            ${sanitize(item.internalNote)}
          `
              : ""
          }
        </td>

        <td>
          <div class="row-actions">
            ${
              isProfessor() || isAdmin()
                ? `
              <button
                class="btn secondary"
                onclick="changeStatus('${item.id}', 'Em análise')"
              >
                Em análise
              </button>

              <button
                class="btn secondary"
                onclick="changeStatus('${item.id}', 'Resolvida')"
              >
                Resolver
              </button>
            `
                : ""
            }

            ${
              canDelete()
                ? `
              <button
                class="btn danger"
                onclick="deleteOccurrence('${item.id}')"
              >
                Excluir
              </button>
            `
                : ""
            }
          </div>
        </td>
      </tr>
    `)
    .join("");

  if (!canViewLogs()) {
    auditLog.innerHTML = `
      <div class="notice">
        Apenas administradores podem visualizar logs.
      </div>
    `;

    return;
  }

  const logs = getAuditLogs();

  if (logs.length === 0) {
    auditLog.innerHTML = `
      <div class="notice">
        Nenhum log registrado.
      </div>
    `;

    return;
  }

  auditLog.innerHTML = logs
    .map(
      (log) => `
      <div class="log-item">
        <strong>${sanitize(log.when)}</strong><br />

        usuário=${sanitize(log.user || "—")}
        |

        perfil=${sanitize(log.role || "—")}
        |

        ação=${sanitize(log.action)}

        <br />

        detalhe=${sanitize(log.detail)}
      </div>
    `
    )
    .join("");
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  login(
    document.querySelector("#email").value,
    document.querySelector("#password").value
  );
});

occurrenceForm.addEventListener(
  "submit",
  createOccurrence
);

logoutBtn.addEventListener("click", logout);

exportBtn.addEventListener(
  "click",
  exportEverything
);

clearLogsBtn.addEventListener(
  "click",
  clearLogs
);

resetBtn.addEventListener(
  "click",
  resetData
);

searchInput.addEventListener(
  "input",
  render
);

window.deleteOccurrence = deleteOccurrence;
window.changeStatus = changeStatus;

boot();

