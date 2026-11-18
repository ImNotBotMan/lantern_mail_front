export const chatsPaths = {
  list: '/chats',
  chat: (id: string) => `/chats/${id}`,
} as const
