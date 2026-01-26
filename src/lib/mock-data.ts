// This file is no longer used for the admin panel, 
// but is kept for potential future reference or other components.

import { PlaceHolderImages } from '@/lib/placeholder-images';

export type UserStatus = 'online' | 'sleeping' | 'muted' | 'listening' | 'playing';
export type UserRole = 'admin' | 'user';
export type ChannelType = 'voice' | 'video';

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  imageHint: string;
  status: UserStatus;
  game?: string;
  isMod?: boolean; // Keep for now, but role is preferred
  role: UserRole;
}

export interface Channel {
  id: string;
  name: string;
  users: User[];
  privacy: 'public' | 'private';
  type: ChannelType;
  allowStreamer?: boolean;
}

const userImages = PlaceHolderImages.filter(p => p.id.startsWith('user-'));

// Ensure user with id '1' is always the primary admin for consistent mock data.
export const mockUsers: User[] = [
  { id: '1', name: 'Zoe', avatarUrl: userImages[0].imageUrl, imageHint: userImages[0].imageHint, status: 'online', isMod: true, role: 'admin' },
  { id: '2', name: 'Alex', avatarUrl: userImages[1].imageUrl, imageHint: userImages[1].imageHint, status: 'playing', game: 'Cyberpunk 2077', role: 'user' },
  { id: '3', name: 'Leo', avatarUrl: userImages[2].imageUrl, imageHint: userImages[2].imageHint, status: 'listening', role: 'user' },
  { id: '4', name: 'Mia', avatarUrl: userImages[3].imageUrl, imageHint: userImages[3].imageHint, status: 'muted', isMod: true, role: 'admin' },
  { id: '5', name: 'Echo', avatarUrl: userImages[4].imageUrl, imageHint: userImages[4].imageHint, status: 'sleeping', role: 'user' },
  { id: '6', name: 'Riven', avatarUrl: userImages[5].imageUrl, imageHint: userImages[5].imageHint, status: 'online', role: 'user' },
  { id: '7', name: 'Kai', avatarUrl: userImages[6].imageUrl, imageHint: userImages[6].imageHint, status: 'playing', game: 'Valorant', role: 'user' },
  { id: '8', name: 'Nova', avatarUrl: userImages[7].imageUrl, imageHint: userImages[7].imageHint, status: 'listening', role: 'user' },
  { id: '9', name: 'Jinx', avatarUrl: userImages[8].imageUrl, imageHint: userImages[8].imageHint, status: 'muted', role: 'user' },
  { id: '10', name: 'Orion', avatarUrl: userImages[9].imageUrl, imageHint: userImages[9].imageHint, status: 'online', role: 'user' },
];

export const mockAdminUser = mockUsers.find(u => u.id === '1')!;
const defaultAdminUsers = mockUsers.filter(u => u.role === 'admin');

export const mockChannels: Channel[] = [
  {
    id: 'on-air',
    name: '🔴 On Air',
    users: [mockAdminUser],
    privacy: 'private',
    type: 'video',
  },
  {
    id: 'mods-only',
    name: '🛡️ Mods Only',
    users: defaultAdminUsers,
    privacy: 'private',
    type: 'voice',
  },
  {
    id: '1',
    name: '🚀 Mission Control',
    users: mockUsers.slice(1, 3),
    privacy: 'public',
    type: 'voice',
    allowStreamer: true,
  },
  {
    id: '2',
    name: '🎮 Gaming Lobby',
    users: mockUsers.slice(3, 7),
    privacy: 'public',
    type: 'voice',
    allowStreamer: true,
  },
  {
    id: '3',
    name: '🎵 Lo-fi Beats',
    users: mockUsers.slice(7, 10),
    privacy: 'public',
    type: 'voice',
  },
  {
    id: '4',
    name: '🎨 Creative Corner',
    users: [],
    privacy: 'public',
    type: 'voice',
  },
];
