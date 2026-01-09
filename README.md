This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Steps to deploy in GCP using Cloud Build

1. Configure local gcloud CLI with your GCP project:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project <your-project-id>
   ```
2. Add roles to default compute service account:
    - Artifact Registry Administrator
    - Logs Writer
3. (One-time) Configure Artifact Registry for Docker authentication:
   ```bash
   gcloud auth configure-docker us-central1-docker.pkg.dev
   ```
4. Create a repository in Artifact Registry through GCP Console or CLI (if not already created):
   ```bash
   gcloud artifacts repositories create <your-repo-name> \
     --repository-format=docker \
     --location=us-central1
   ```
5. Build and push the Docker image using Cloud Build (build happens on GCP, linux/amd64):
   ```bash
   gcloud builds submit \
     --tag us-central1-docker.pkg.dev/<your-project-id>/<your-repo-name>/<your-image-name>:<tag>
   ```
6. Deploy the image to Cloud Run:
   ```bash
   gcloud run deploy <your-service-name> \
     --image us-central1-docker.pkg.dev/<your-project-id>/<your-repo-name>/<your-image-name>:<tag> \
     --region us-central1 \
     --allow-unauthenticated
   ```
    - In the Cloud Run console, ensure:
        - Container port is set to `3000`.
        - **Command/Arguments** are left empty so Cloud Run uses the Dockerfile `CMD ["npm", "start"]`.
