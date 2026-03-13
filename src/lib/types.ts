export type AuthMethod = "wallet" | "key";

export interface AuthState {
  method: AuthMethod;
  address: string;
}
