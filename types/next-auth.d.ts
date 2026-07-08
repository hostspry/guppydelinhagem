import "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    senhaPrecisaTroca: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image?: string | null; // foto do provider OAuth (Google/Facebook)
      role: string;
      senhaPrecisaTroca: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    senhaPrecisaTroca?: boolean;
  }
}
