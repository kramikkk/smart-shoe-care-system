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

export const getSession = async () => {
    const session = await auth.api.getSession({headers: await headers()});
    return session;
};

export const updateUser = async (data: { name?: string; image?: string }) => {
    const result = await auth.api.updateUser({
        body: data,
        headers: await headers(),
    });
    return result;
};