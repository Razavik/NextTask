import { useEffect, useState, useCallback } from "react";

interface User {
  id: number;
  email: string;
  name?: string;
  token?: string;
}

/**
 * Хук авторизации (пример). Данные хранятся в localStorage, как и в проекте AniTales.
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((data: User) => {
    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  return { user, isLoading, isAuthenticated: !!user, login, logout };
};
