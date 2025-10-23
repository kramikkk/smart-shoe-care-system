import { auth } from "@/lib/auth";

async function createAdminUser() {
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: "admin@sscm.com",
        password: "admin123", // Change this!
        name: "Admin User",
      },
    });
    
    console.log("Admin user created:", result);
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
}

createAdminUser();
