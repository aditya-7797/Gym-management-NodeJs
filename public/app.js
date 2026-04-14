const membersList = document.getElementById('membersList');
const memberForm = document.getElementById('memberForm');
const formMessage = document.getElementById('formMessage');
const searchInput = document.getElementById('searchInput');
const refreshButton = document.getElementById('refreshButton');
const themeToggle = document.getElementById('themeToggle');
const clock = document.getElementById('clock');
const totalMembers = document.getElementById('totalMembers');
const activeMembers = document.getElementById('activeMembers');
const premiumMembers = document.getElementById('premiumMembers');
const upcomingRenewals = document.getElementById('upcomingRenewals');

const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const planInput = document.getElementById('plan');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;

let allMembers = [];

function readCookie(name) {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  themeToggle.textContent = theme === 'dark' ? 'Use light theme' : 'Use dark theme';
}

function loadTheme() {
  const savedTheme = readCookie('gym-theme') || 'light';
  applyTheme(savedTheme);
}

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString();
}

function daysLeft(member) {
  const remaining = new Date(member.membershipEndsAt) - new Date();
  return Math.max(0, Math.ceil(remaining / 86400000));
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function renderStats(members) {
  const activeCount = members.filter((member) => member.isActive).length;
  const premiumCount = members.filter((member) => member.plan === 'Premium').length;
  const renewalsCount = members.filter((member) => daysLeft(member) <= 14).length;

  totalMembers.textContent = members.length;
  activeMembers.textContent = activeCount;
  premiumMembers.textContent = premiumCount;
  upcomingRenewals.textContent = renewalsCount;
}

function getFilteredMembers() {
  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    return allMembers;
  }

  return allMembers.filter((member) => {
    const searchableText = `${member.id} ${member.name} ${member.email}`.toLowerCase();
    return searchableText.includes(query);
  });
}

function renderMembers() {
  const filteredMembers = getFilteredMembers();

  if (!filteredMembers.length) {
    membersList.innerHTML = '<p class="message">No members found.</p>';
    return;
  }

  membersList.innerHTML = filteredMembers
    .map((member) => {
      const renewalLabel = `${daysLeft(member)} day${daysLeft(member) === 1 ? '' : 's'} left`;
      const lastCheckIn = member.lastCheckIn ? formatDate(member.lastCheckIn) : 'Never';
      const checkInCount = Array.isArray(member.checkIns) ? member.checkIns.length : 0;

      return `
        <article class="member-card">
          <div class="member-top">
            <div>
              <strong>${member.name}</strong>
              <div class="member-meta">
                <span>${member.id}</span>
                <span>${member.email}</span>
                <span>${member.phone}</span>
              </div>
            </div>
            <span class="badge">${member.plan}</span>
          </div>
          <div class="member-meta">
            <span>Joined: ${formatDate(member.joinedAt)}</span>
            <span>Membership ends: ${formatDate(member.membershipEndsAt)} (${renewalLabel})</span>
            <span>Last check-in: ${lastCheckIn}</span>
            <span>Check-ins: ${checkInCount}</span>
          </div>
          <div class="card-actions">
            <button class="secondary-button" type="button" data-checkin="${member.id}">Check In</button>
          </div>
        </article>
      `;
    })
    .join('');

  document.querySelectorAll('[data-checkin]').forEach((button) => {
    button.addEventListener('click', () => recordCheckIn(button.dataset.checkin));
  });
}

async function loadMembers() {
  const response = await fetch('/api/members');
  const data = await response.json();

  allMembers = data.members || [];
  renderStats(allMembers);
  renderMembers();
}

async function addMember(member) {
  const response = await fetch('/api/members', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(member),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Could not add member.');
  }

  return result.member;
}

async function recordCheckIn(memberId) {
  const response = await fetch(`/api/members/${memberId}/checkin`, {
    method: 'POST',
  });
  const result = await response.json();

  if (!response.ok) {
    formMessage.textContent = result.message || 'Could not record check-in.';
    return;
  }

  formMessage.textContent = `${result.member.name} checked in successfully.`;
  await loadMembers();
}

function validateForm(name, email, phone) {
  if (name.trim().length < 3) {
    return 'Name must be at least 3 characters long.';
  }

  if (!emailPattern.test(email.trim().toLowerCase())) {
    return 'Enter a valid email address.';
  }

  if (!phonePattern.test(phone.trim())) {
    return 'Phone number must contain exactly 10 digits.';
  }

  return '';
}

memberForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = nameInput.value;
  const email = emailInput.value;
  const phone = phoneInput.value;
  const plan = planInput.value;
  const validationMessage = validateForm(name, email, phone);

  if (validationMessage) {
    formMessage.textContent = validationMessage;
    return;
  }

  try {
    const addedMember = await addMember({ name, email, phone, plan });
    formMessage.textContent = `${addedMember.name} added successfully.`;
    memberForm.reset();
    planInput.value = 'Basic';
    await loadMembers();
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

searchInput.addEventListener('input', renderMembers);
refreshButton.addEventListener('click', loadMembers);

themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
  setCookie('gym-theme', nextTheme, 30);
  applyTheme(nextTheme);
});

loadTheme();
updateClock();
loadMembers();
setInterval(updateClock, 1000);
setInterval(renderMembers, 1000);
