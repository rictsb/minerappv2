/**
 * Projects Route
 * API endpoints for managing sites, phases, and tenancies
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// ===========================================
// SITES
// ===========================================

// GET /api/v1/sites
// Get all sites with optional filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const { ticker } = req.query;

    const sites = await prisma.site.findMany({
      where: ticker ? { ticker: ticker as string } : undefined,
      include: {
        phases: {
          include: {
            tenancies: true,
          },
        },
        company: {
          select: {
            ticker: true,
            name: true,
          },
        },
      },
      orderBy: [
        { ticker: 'asc' },
        { name: 'asc' },
      ],
    });

    res.json(sites);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// GET /api/v1/sites/:id
// Get a single site by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        phases: {
          include: {
            tenancies: true,
          },
        },
        company: true,
        factors: true,
      },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json(site);
  } catch (error) {
    console.error('Error fetching site:', error);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

// PATCH /api/v1/sites/:id
// Update a site
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      country,
      state,
      latitude,
      longitude,
      googleMapsLink,
      powerAuthority,
      grid,
      ownershipStatus,
      datacenterTier,
      includeInValuation,
      confidence,
      notes,
      sourceUrl,
    } = req.body;

    // Build update data object with only provided fields
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (country !== undefined) updateData.country = country;
    if (state !== undefined) updateData.state = state || null;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (googleMapsLink !== undefined) updateData.googleMapsLink = googleMapsLink;
    if (powerAuthority !== undefined) updateData.powerAuthority = powerAuthority;
    if (grid !== undefined) updateData.grid = grid;
    if (ownershipStatus !== undefined) updateData.ownershipStatus = ownershipStatus;
    if (datacenterTier !== undefined) updateData.datacenterTier = datacenterTier;
    if (includeInValuation !== undefined) updateData.includeInValuation = includeInValuation;
    if (confidence !== undefined) updateData.confidence = confidence;
    if (notes !== undefined) updateData.notes = notes;
    if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl;

    const site = await prisma.site.update({
      where: { id },
      data: updateData,
      include: {
        phases: {
          include: {
            tenancies: true,
          },
        },
      },
    });

    res.json(site);
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// POST /api/v1/sites
// Create a new site
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      ticker,
      name,
      country,
      state,
      ownershipStatus = 'OWNED',
      confidence = 'MEDIUM',
      includeInValuation = true,
      ...rest
    } = req.body;

    if (!ticker || !name || !country) {
      return res.status(400).json({ error: 'ticker, name, and country are required' });
    }

    const site = await prisma.site.create({
      data: {
        ticker,
        name,
        country,
        state: state || null,
        ownershipStatus,
        confidence,
        includeInValuation,
        ...rest,
      },
      include: {
        phases: true,
      },
    });

    res.status(201).json(site);
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

// DELETE /api/v1/sites/:id
// Delete a site
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.site.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// ===========================================
// PHASES
// ===========================================

// GET /api/v1/phases
// Get all phases with optional filtering
router.get('/phases', async (req: Request, res: Response) => {
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

export default router;
