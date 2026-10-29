import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("streamcloud_user");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'

  useEffect(() => {
    if (user) {
      localStorage.setItem("streamcloud_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("streamcloud_user");
    }
  }, [user]);

  const login = async (email, password) => {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to log in.");
    }

    const userData = {
      ...data.user,
      token: data.token
    };

    setUser(userData);
    setAuthModalOpen(false);
    return userData;
  };

  const register = async (name, email, password, role = "user") => {
    const res = await fetch("http://localhost:5000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to register.");
    }

    const userData = {
      ...data.user,
      token: data.token
    };

    setUser(userData);
    setAuthModalOpen(false);
    return userData;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("streamcloud_user");
  };

  const openLogin = () => {
    setAuthMode("login");
    setAuthModalOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const isAdmin = user?.role === "admin";
  const token = user?.token;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAdmin,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        authModalOpen,
        authMode,
        setAuthMode,
        openLogin,
        openRegister,
        closeAuthModal
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
