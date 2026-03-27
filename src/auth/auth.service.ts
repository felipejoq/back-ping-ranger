import { config } from 'dotenv';
config();

import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { Pool } from 'pg';

const globalForPool = globalThis as unknown as { authPgPool: Pool | undefined };

const pool =
  globalForPool.authPgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

globalForPool.authPgPool = pool;

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  basePath: '/api/auth',
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      getUserInfo: async (token) => {
        console.log('[GitHub] accessToken:', token.accessToken?.slice(0, 15) + '...');

        const profileRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
            'User-Agent': 'pingranger',
            Accept: 'application/json',
          },
        });
        console.log('[GitHub] /user status:', profileRes.status);
        const profile = await profileRes.json() as Record<string, unknown>;
        console.log('[GitHub] profile.email:', profile.email);

        if (!profile.email) {
          const emailsRes = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
              'User-Agent': 'pingranger',
              Accept: 'application/json',
            },
          });
          console.log('[GitHub] /user/emails status:', emailsRes.status);
          const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
          console.log('[GitHub] emails:', JSON.stringify(emails));
          const primary = emails?.find?.((e) => e.primary);
          profile.email = primary?.email ?? emails?.[0]?.email;
        }

        return {
          user: {
            id: String(profile.id),
            name: (profile.name as string) || (profile.login as string) || '',
            email: profile.email as string,
            image: profile.avatar_url as string,
            emailVerified: true,
          },
          data: profile,
        };
      },
    },
  },
  plugins: [jwt()],
  trustedOrigins: [process.env.FRONTEND_URL ?? 'http://localhost:3001'],
});
