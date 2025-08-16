import { Request, Response } from "express";
import { wompiService } from "../services/wompi.service";

/**
 * Get PSE Financial Institutions
 * GET /api/pse/banks
 */
export const getPSEBanks = async (req: Request, res: Response) => {
  try {
    console.log('[PSE] Getting financial institutions...');
    
    const banksResponse = await wompiService().getPSEFinancialInstitutions();
    
    console.log(`[PSE] Found ${banksResponse.data.length} banks`);
    
    res.status(200).json({
      success: true,
      data: banksResponse.data
    });
    
  } catch (error: any) {
    console.error('[PSE] Error fetching banks:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch PSE banks',
      details: error.message 
    });
  }
};
