const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const app = express();
const port = process.env.PORT || 3000;
const dataFilePath = path.join(__dirname, 'data', 'members.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;

async function readMembers() {
  const rawData = await fs.readFile(dataFilePath, 'utf8');
  return JSON.parse(rawData);
}

async function writeMembers(members) {
  await fs.writeFile(dataFilePath, JSON.stringify(members, null, 2));
}

function generateMemberId(members) {
  const nextNumber = members.length + 1;
  return `GYM-${String(nextNumber).padStart(4, '0')}`;
}

function buildJoinDate() {
  return new Date().toISOString();
}

function buildExpiryDate(months) {
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + months);
  return expiryDate.toISOString();
}

function calculateStats(members) {
  const activeMembers = members.filter((member) => member.isActive);
  const premiumMembers = members.filter((member) => member.plan === 'Premium');
  const upcomingRenewals = members.filter((member) => {
    const daysLeft = Math.ceil((new Date(member.membershipEndsAt) - new Date()) / 86400000);
    return daysLeft <= 14 && daysLeft >= 0;
  });

  return {
    totalMembers: members.length,
    activeMembers: activeMembers.length,
    premiumMembers: premiumMembers.length,
    upcomingRenewals: upcomingRenewals.length,
  };
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    message: 'Gym management API is running.',
  });
});

app.get('/api/members', async (req, res) => {
  try {
    const members = await readMembers();
    res.json({ members, stats: calculateStats(members) });
  } catch (error) {
    res.status(500).json({ message: 'Could not read members.', error: error.message });
  }
});

app.post('/api/members', async (req, res) => {
  try {
    const { name, email, phone, plan } = req.body;
    const trimmedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPhone = String(phone || '').trim();
    const selectedPlan = ['Basic', 'Standard', 'Premium'].includes(plan) ? plan : 'Basic';

    if (trimmedName.length < 3) {
      return res.status(400).json({ message: 'Name must be at least 3 characters long.' });
    }

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    if (!phonePattern.test(normalizedPhone)) {
      return res.status(400).json({ message: 'Phone number must contain exactly 10 digits.' });
    }

    const members = await readMembers();
    const duplicateEmail = members.some((member) => member.email === normalizedEmail);

    if (duplicateEmail) {
      return res.status(400).json({ message: 'A member with this email already exists.' });
    }

    const newMember = {
      id: generateMemberId(members),
      name: trimmedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      plan: selectedPlan,
      isActive: true,
      joinedAt: buildJoinDate(),
      membershipEndsAt: buildExpiryDate(selectedPlan === 'Premium' ? 6 : 3),
      checkIns: [],
    };

    members.unshift(newMember);
    await writeMembers(members);

    res.status(201).json({ message: 'Member added successfully.', member: newMember });
  } catch (error) {
    res.status(500).json({ message: 'Could not add member.', error: error.message });
  }
});

app.post('/api/members/:id/checkin', async (req, res) => {
  try {
    const memberId = req.params.id;
    const members = await readMembers();
    const targetMember = members.find((member) => member.id === memberId);

    if (!targetMember) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    const checkInTime = new Date().toISOString();
    targetMember.lastCheckIn = checkInTime;
    targetMember.checkIns = Array.isArray(targetMember.checkIns) ? targetMember.checkIns : [];
    targetMember.checkIns.push(checkInTime);
    targetMember.isActive = true;

    await writeMembers(members);

    res.json({ message: 'Check-in recorded.', member: targetMember });
  } catch (error) {
    res.status(500).json({ message: 'Could not record check-in.', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Gym management app running on http://localhost:${port}`);
});