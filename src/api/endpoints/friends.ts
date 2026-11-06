import { api } from '../client'
import type { Friend, IncomingFriendRequest, OutgoingFriendRequest } from '../types'

export const friendsApi = {
  list(): Promise<Friend[]> {
    return api.request<Friend[]>('GET', '/friends')
  },

  remove(username: string): Promise<void> {
    return api.request<void>('DELETE', `/friends/${encodeURIComponent(username)}`)
  },

  sendRequest(recipientUsername: string): Promise<OutgoingFriendRequest> {
    return api.request<OutgoingFriendRequest>('POST', '/friends/requests', {
      body: { recipient_username: recipientUsername },
    })
  },

  incoming(): Promise<IncomingFriendRequest[]> {
    return api.request<IncomingFriendRequest[]>('GET', '/friends/requests/incoming')
  },

  outgoing(): Promise<OutgoingFriendRequest[]> {
    return api.request<OutgoingFriendRequest[]>('GET', '/friends/requests/outgoing')
  },

  accept(requestId: string): Promise<Friend> {
    return api.request<Friend>('POST', `/friends/requests/${requestId}/accept`)
  },

  decline(requestId: string): Promise<void> {
    return api.request<void>('POST', `/friends/requests/${requestId}/decline`)
  },

  withdraw(requestId: string): Promise<void> {
    return api.request<void>('DELETE', `/friends/requests/${requestId}`)
  },
}
