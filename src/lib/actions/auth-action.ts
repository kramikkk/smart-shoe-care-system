"use server"

import { headers } from "next/headers"
import { auth } from "../auth"

export const signIn = async (email: string, password: string) => {
    const result = await auth.api.signInEmail({
        body: {
            email, password, callbackURL: "/admin/dashboard"
        },
    });
    return result;
};

export const signOut = async () => {
    const result = await auth.api.signOut({headers: await headers()});
    return result;
};