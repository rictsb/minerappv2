/**
 * Phases Route
 * API endpoints for managing phases
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// GET /api/v1/phases
// Get all phases with optional filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const { siteId, status } = req.query;

    const phases = await prisma.phase.findMany({
      where: {
        siteId: siteId ? (siteId as string) : undefined,
        status: status ? (status as any) : undefined,
      },
      include: {
        tenancies: true,
        site: {
          select: {
            id: true,
            name: true,
            ticker: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(phases);
  } catch (error) {
    console.error('Error fetching phases:', error);
    res.status(500).json({ error: 'Failed to fetch phases' });
  }
});

// GET /api/v1/phases/:id
// Get a single phase by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const phase = await prisma.phase.findUnique({
      where: { id },
      include: {
        tenancies: true,
        site: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!phase) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    res.json(phase);
  } catch (error) {
    console.error('Error fetching phase:', error);
    res.status(500).json({ error: 'Failed to fetch phase' });
  }
});

// PATCH /api/v1/phases/:id
// Update a phase
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      status,
      grossMw,
      itMw,
      pue,
      pueSource,
      energizationDate,
      energizationActual,
      currentUse,
      changeType,
      suggestDelete,
    } = req.body;

    // Build update data object with only provided fields
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (status !== undefined) updateData.status = status;
    if (grossMw !== undefined) updateData.grossMw = grossMw;
    if (itMw !== undefined) updateData.itMw = itMw;
    if (pue !== undefined) updateData.pue = pue;
    if (pueSource !== undefined) updateData.pueSource = pueSource;
    if (energizationDate !== undefined) updateData.energizationDate = energizationDate ? new Date(energizationDate) : null;
    if (energizationActual !== undefined) updateData.energizationActual = energizationActual;
    if (currentUse !== undefined) updateData.currentUse = currentUse;
    if (changeType !== undefined) updateData.changeType = changeType;
    if (suggestDelete !== undefined) updateData.suggestDelete = suggestDelete;

    const phase = await prisma.phase.update({
      where: { id },
      data: updateData,
      include: {
        tenancies: true,
        site: {
          select: {
            id: true,
            name: true,
            ticker: true,
          },
        },
      },
    });

    res.json(phase);
  } catch (error) {
    console.error('Error updating phase:', error);
    res.status(500).json({ error: 'Failed to update phase' });
  }
});

// POST /api/v1/phases
// Create a new phase
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      siteId,
      name,
      status = 'PIPELINE',
      grossMw,
      itMw,
      pue,
      currentUse = 'BTC_MINING',
      energizationDate,
      ...rest
    } = req.body;

    if (!siteId || !name) {
      return res.status(400).json({ error: 'siteId and name are required' });
    }

    const phase = await prisma.phase.create({
      data: {
        siteId,
        name,
        status,
        grossMw: grossMw || null,
        itMw: itMw || null,
        pue: pue || null,
        currentUse,
        energizationDate: energizationDate ? new Date(energizationDate) : null,
        ...rest,
      },
      include: {
        tenancies: true,
      },
    });

    res.status(201).json(phase);
  } catch (error) {
    console.error('Error creating phase:', error);
    res.status(500).json({ error: 'Failed to create phase' });
  }
});

// DELETE /api/v1/phases/:id
// Delete a phase
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.phase.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting phase:', error);
    res.status(500).json({ error: 'Failed to delete phase' });
  }
});

export default router;
