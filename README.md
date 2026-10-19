# Cat'Peas storefront

A responsive eyewear storefront built with React, TypeScript, Vite, and Supabase. The product catalogue can be previewed locally without credentials; accounts, newsletter/contact submissions, live product management, and order requests use Supabase.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Install packages:

   ```sh
   npm install
   ```

3. Start the development server:

   ```sh
   npm run dev
   ```

4. Open the local URL printed by Vite. `npm run build` creates the production site in `dist/`.

## Set up the Supabase database

1. Create a project at [supabase.com](https://supabase.com/).
2. In the Supabase dashboard, open **SQL Editor** → **New query**.
3. Copy the complete contents of [`supabase/schema.sql`](./supabase/schema.sql) into the editor and choose **Run**. This creates the product catalogue, profile/auth trigger, newsletter and contact tables, order tables, row-level security policies, and the server-priced `create_order` function. It also seeds the 16 products currently in the storefront. The script can be run again safely to refresh the catalogue.
4. In **Authentication** → **Providers**, enable **Email**. For production, configure the site's URL and allowed redirect URLs in **Authentication** → **URL Configuration**. Include your local development URL (for example `http://localhost:5173/**`) while developing and your Vercel domain.
5. From **Project Settings** → **API**, copy the project URL and the publishable/anon key. Do not use a `service_role` key in the browser.
6. Create a local `.env` from `.env.example` and fill it in:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-publishable-key
   ```

   Restart Vite after changing environment variables. Never commit `.env`.

The app reads product records from Supabase when configured. Without the variables, it uses the bundled catalogue for a local UI preview; forms and account/order actions will explain that Supabase must be connected.

## Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel, or run `npx vercel`.
2. Use the detected Vite settings (build command `npm run build`, output directory `dist`). [`vercel.json`](./vercel.json) already configures these and routes deep links to the React app.
3. In the Vercel project's **Settings** → **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the environments you deploy.
4. Redeploy after adding or changing environment variables.
5. Add the deployed Vercel URL to the Supabase **Authentication** site URL and redirect URL allow-list.

## Backend notes

- Supabase Auth provides email/password registration and sign-in. Configure email confirmation in the Supabase Auth settings to control whether new users must verify their email.
- The browser uses only the public anon/publishable key. Row-level security restricts profiles and order reads to their owner. The `create_order` database function obtains prices from the product table instead of trusting prices sent by the browser.
- Checkout creates an order request; it does **not** process payments. Connect a payment provider and add server-side payment confirmation before accepting online payments.
- Contact messages and newsletter sign-ups are public inserts and are not readable by anonymous clients. Review and manage those records from the Supabase dashboard.
- The product photos remain in `public/img/`; edit prices, visibility, and names in the Supabase `products` table after the initial seed.
