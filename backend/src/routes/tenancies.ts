/**
 * Tenancies Route
 * API endpoints for managing tenancies
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// GET /api/v1/tenancies
// Get all tenancies with optional filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const { phaseId } = req.query;

    const tenancies = await prisma.tenancy.findMany({
      where: {
        phaseId: phaseId ? (phaseId as string) : undefined,
      },
      include: {
        phase: {
          select: {
            id: true,
            name: true,
            site: {
              select: {
                id: true,
                name: true,
                ticker: true,
              },
            },
          },
        },
      },
      orderBy: { tenant: 'asc' },
    });

    res.json(tenancies);
  } catch (error) {
    console.error('Error fetching tenancies:', error);
    res.status(500).json({ error: 'Failed to fetch tenancies' });
  }
});

// GET /api/v1/tenancies/:id
// Get a single tenancy by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tenancy = await prisma.tenancy.findUnique({
      where: { id },
      include: {
        phase: {
          include: {
            site: {
              include: {
                company: true,
              },
            },
          },
        },
      },
    });

    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' });
    }

    res.json(tenancy);
  } catch (error) {
    console.error('Error fetching tenancy:', error);
    res.status(500).json({ error: 'Failed to fetch tenancy' });
  }
});

// PATCH /api/v1/tenancies/:id
// Update a tenancy
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      tenant,
      useType,
      leaseStructure,
      leaseValueM,
      leaseYears,
      annualRevenueM,
      noiPct,
      noiAnnualM,
      leaseStart,
      leaseNotes,
      hpcConvProb,
      fidoodle,
      miningPowerCostKwh,
      miningCurtailmentPct,
      miningNonpowerOpexMwMo,
      miningEfficiencyJth,
    } = req.body;

    // Build update data object with only provided fields
    const updateData: any = {};

    if (tenant !== undefined) updateData.tenant = tenant;
    if (useType !== undefined) updateData.useType = useType;
    if (leaseStructure !== undefined) updateData.leaseStructure = leaseStructure;
    if (leaseValueM !== undefined) updateData.leaseValueM = leaseValueM;
    if (leaseYears !== undefined) updateData.leaseYears = leaseYears;
    if (annualRevenueM !== undefined) updateData.annualRevenueM = annualRevenueM;
    if (noiPct !== undefined) updateData.noiPct = noiPct;
    if (noiAnnualM !== undefined) updateData.noiAnnualM = noiAnnualM;
    if (leaseStart !== undefined) updateData.leaseStart = leaseStart ? new Date(leaseStart) : null;
    if (leaseNotes !== undefined) updateData.leaseNotes = leaseNotes;
    if (hpcConvProb !== undefined) updateData.hpcConvProb = hpcConvProb;
    if (fidoodle !== undefined) updateData.fidoodle = fidoodle;
    if (miningPowerCostKwh !== undefined) updateData.miningPowerCostKwh = miningPowerCostKwh;
    if (miningCurtailmentPct !== undefined) updateData.miningCurtailmentPct = miningCurtailmentPct;
    if (miningNonpowerOpexMwMo !== undefined) updateData.miningNonpowerOpexMwMo = miningNonpowerOpexMwMo;
    if (miningEfficiencyJth !== undefined) updateData.miningEfficiencyJth = miningEfficiencyJth;

    const tenancy = await prisma.tenancy.update({
      where: { id },
      data: updateData,
      include: {
        phase: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(tenancy);
  } catch (error) {
    console.error('Error updating tenancy:', error);
    res.status(500).json({ error: 'Failed to update tenancy' });
  }
});

// POST /api/v1/tenancies
// Create a new tenancy
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      phaseId,
      tenant,
      useType = 'BTC_MINING',
      leaseValueM,
      annualRevenueM,
      ...rest
    } = req.body;

    if (!phaseId || !tenant) {
      return res.status(400).json({ error: 'phaseId and tenant are required' });
    }

    const tenancy = await prisma.tenancy.create({
      data: {
        phaseId,
        tenant,
        useType,
        leaseValueM: leaseValueM || null,
        annualRevenueM: annualRevenueM || null,
        ...rest,
      },
    });

    res.status(201).json(tenancy);
  } catch (error) {
    console.error('Error creating tenancy:', error);
    res.status(500).json({ error: 'Failed to create tenancy' });
  }
});

// DELETE /api/v1/tenancies/:id
// Delete a tenancy
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.tenancy.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tenancy:', error);
    res.status(500).json({ error: 'Failed to delete tenancy' });
  }
});

export default router;
