export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  console.log(
    "[boot] frontend env:",
    JSON.stringify(
      {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_CROO_API_BASE_URL: process.env.NEXT_PUBLIC_CROO_API_BASE_URL,
        NEXT_PUBLIC_CROO_AI_BASE_URL: process.env.NEXT_PUBLIC_CROO_AI_BASE_URL,
        NEXT_PUBLIC_COS_HOST: process.env.NEXT_PUBLIC_COS_HOST,
        NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
          process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        BACKEND_URL: process.env.BACKEND_URL,
      },
      null,
      2,
    ),
  );
}
