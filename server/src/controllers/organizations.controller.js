const prisma = require('../services/prisma.service');

// Create a new organization and make the creator an ADMIN
exports.createOrganization = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Organization name is required.' });
    }

    // Use transaction to create organization and admin membership together
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name },
      });

      const membership = await tx.membership.create({
        data: {
          userId,
          organizationId: org.id,
          role: 'ADMIN',
        },
      });

      return { org, membership };
    });

    res.status(201).json(result.org);
  } catch (error) {
    console.error('createOrganization error:', error);
    res.status(500).json({ error: 'An error occurred while creating the organization.' });
  }
};

// Get all organizations the authenticated user belongs to
exports.getOrganizations = async (req, res) => {
  try {
    const userId = req.user.userId;

    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: {
        organization: {
          name: 'asc',
        },
      },
    });

    const organizations = memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));

    res.status(200).json(organizations);
  } catch (error) {
    console.error('getOrganizations error:', error);
    res.status(500).json({ error: 'An error occurred while fetching organizations.' });
  }
};

// Get all members of a specific organization
exports.getOrganizationMembers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const organizationId = parseInt(req.params.id, 10);

    if (isNaN(organizationId)) {
      return res.status(400).json({ error: 'Invalid organization ID.' });
    }

    // Verify current user is a member of the organization
    const userMembership = await prisma.membership.findFirst({
      where: { userId, organizationId },
    });

    if (!userMembership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this organization.' });
    }

    const memberships = await prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    const members = memberships.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      role: m.role,
      membershipId: m.id,
    }));

    res.status(200).json(members);
  } catch (error) {
    console.error('getOrganizationMembers error:', error);
    res.status(500).json({ error: 'An error occurred while fetching members.' });
  }
};

// Invite a user to the organization by email
exports.inviteMember = async (req, res) => {
  try {
    const userId = req.user.userId;
    const organizationId = parseInt(req.params.id, 10);
    const { email } = req.body;

    if (isNaN(organizationId)) {
      return res.status(400).json({ error: 'Invalid organization ID.' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    // Verify current user is a member of the organization
    const userMembership = await prisma.membership.findFirst({
      where: { userId, organizationId },
    });

    if (!userMembership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this organization.' });
    }

    // Find the user to invite
    const userToInvite = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!userToInvite) {
      return res.status(404).json({ error: 'User with this email does not exist.' });
    }

    // Check if the user is already a member
    const existingMembership = await prisma.membership.findFirst({
      where: { userId: userToInvite.id, organizationId },
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member of this organization.' });
    }

    // Create MEMBER membership
    const newMembership = await prisma.membership.create({
      data: {
        userId: userToInvite.id,
        organizationId,
        role: 'MEMBER',
      },
    });

    res.status(201).json({
      message: 'Teammate invited successfully.',
      membership: newMembership,
    });
  } catch (error) {
    console.error('inviteMember error:', error);
    res.status(500).json({ error: 'An error occurred while inviting the member.' });
  }
};

// Remove a member from the organization
exports.removeMember = async (req, res) => {
  try {
    const userId = req.user.userId;
    const organizationId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(organizationId) || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid parameters.' });
    }

    // Verify current user is an ADMIN of the organization
    const adminMembership = await prisma.membership.findFirst({
      where: { userId, organizationId, role: 'ADMIN' },
    });

    if (!adminMembership) {
      return res.status(403).json({ error: 'Access denied. Only organization admins can remove members.' });
    }

    if (userId === targetUserId) {
      return res.status(400).json({ error: 'You cannot remove yourself from the organization.' });
    }

    // Find target membership
    const targetMembership = await prisma.membership.findFirst({
      where: { userId: targetUserId, organizationId },
    });

    if (!targetMembership) {
      return res.status(404).json({ error: 'Member not found in this organization.' });
    }

    // Delete membership
    await prisma.membership.delete({
      where: { id: targetMembership.id },
    });

    res.status(200).json({ message: 'Member removed successfully.' });
  } catch (error) {
    console.error('removeMember error:', error);
    res.status(500).json({ error: 'An error occurred while removing the member.' });
  }
};
