// src/utils/storage.ts

export const storeUserSession = (user: any, token: string) => {
  if (!user || !token) return;

  localStorage.setItem("userToken", token);
  localStorage.setItem("userData", JSON.stringify(user));
  localStorage.setItem("userId", user._id);
};

// (Optional helper if you ever need to get user info later)
export const getUserSession = () => {
  const token = localStorage.getItem("userToken");
  const userRaw = localStorage.getItem("userData");
  const userId = localStorage.getItem("userId");
  const user = userRaw ? JSON.parse(userRaw) : null;
  return { token, user, userId };
};
