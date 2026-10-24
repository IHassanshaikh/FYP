import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  register: (email: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_STORAGE_KEY = '@vb_users';
const CURRENT_USER_KEY = '@vb_current_user_id';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUserId = await AsyncStorage.getItem(CURRENT_USER_KEY);
        if (currentUserId) {
          const usersJson = await AsyncStorage.getItem(USERS_STORAGE_KEY);
          const users: User[] = usersJson ? JSON.parse(usersJson) : [];
          const foundUser = users.find(u => u.id === currentUserId);
          if (foundUser) {
            setUser(foundUser);
          }
        }
      } catch (e) {
        console.error('Failed to load user', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (email: string) => {
    try {
      const usersJson = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      const users: User[] = usersJson ? JSON.parse(usersJson) : [];
      
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        await AsyncStorage.setItem(CURRENT_USER_KEY, existingUser.id);
        setUser(existingUser);
      } else {
        throw new Error('User not found. Please register.');
      }
    } catch (error) {
      console.error('Login error', error);
      throw error;
    }
  };

  const register = async (email: string, name: string) => {
    try {
      const usersJson = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      const users: User[] = usersJson ? JSON.parse(usersJson) : [];
      
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('User already exists');
      }

      const newUser: User = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        email,
        name,
      };

      users.push(newUser);
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      await AsyncStorage.setItem(CURRENT_USER_KEY, newUser.id);
      setUser(newUser);
    } catch (error) {
      console.error('Registration error', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
      setUser(null);
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
