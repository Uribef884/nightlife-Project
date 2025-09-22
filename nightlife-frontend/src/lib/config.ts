// Configuration file for environment variables and API settings
export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  },
  app: {
    name: 'NightLife',
    description: 'Tickets, events, and menus for nightclubs.',
  },
};
