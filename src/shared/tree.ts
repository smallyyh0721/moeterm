import type { PublicNode, StoredConnection, StoredFolder, StoredNode } from './types';

export interface FoundNode {
  node: StoredNode;
  parentId: string | null;
}

export function findNode(nodes: StoredNode[], id: string, parentId: string | null = null): FoundNode | null {
  for (const node of nodes) {
    if (node.id === id) return { node, parentId };
    if (node.type === 'folder') {
      const nested = findNode(node.children, id, node.id);
      if (nested) return nested;
    }
  }
  return null;
}

export function insertNode(nodes: StoredNode[], parentId: string | null, node: StoredNode): StoredNode[] {
  if (parentId === null) return [...nodes, node];
  if (!findNode(nodes, parentId)) throw new Error('找不到目录');
  const walk = (list: StoredNode[]): StoredNode[] =>
    list.map((item) => {
      if (item.type !== 'folder') return item;
      if (item.id === parentId) return { ...item, children: [...item.children, node] };
      return { ...item, children: walk(item.children) };
    });
  return walk(nodes);
}

export function removeNode(nodes: StoredNode[], id: string): { nodes: StoredNode[]; removed: StoredNode | null } {
  let removed: StoredNode | null = null;
  const walk = (list: StoredNode[]): StoredNode[] => {
    const next: StoredNode[] = [];
    for (const item of list) {
      if (item.id === id) {
        removed = item;
        continue;
      }
      if (item.type === 'folder') next.push({ ...item, children: walk(item.children) });
      else next.push(item);
    }
    return next;
  };
  return { nodes: walk(nodes), removed };
}

export function replaceNode(nodes: StoredNode[], id: string, next: StoredNode): StoredNode[] {
  let found = false;
  const walk = (list: StoredNode[]): StoredNode[] =>
    list.map((item) => {
      if (item.id === id) {
        found = true;
        return next;
      }
      if (item.type === 'folder') return { ...item, children: walk(item.children) };
      return item;
    });
  const updated = walk(nodes);
  if (!found) throw new Error('找不到这一项');
  return updated;
}

export function renameNode(nodes: StoredNode[], id: string, name: string): StoredNode[] {
  const found = findNode(nodes, id);
  if (!found) throw new Error('找不到要重命名的项');
  return replaceNode(nodes, id, { ...found.node, name });
}

function isInsideFolder(folder: StoredFolder, id: string): boolean {
  for (const child of folder.children) {
    if (child.id === id) return true;
    if (child.type === 'folder' && isInsideFolder(child, id)) return true;
  }
  return false;
}

export function canMove(nodes: StoredNode[], id: string, parentId: string | null): boolean {
  const moving = findNode(nodes, id);
  if (!moving) return false;
  if (parentId === null) return true;
  if (parentId === id) return false;
  const parent = findNode(nodes, parentId);
  if (!parent || parent.node.type !== 'folder') return false;
  if (moving.node.type === 'folder' && isInsideFolder(moving.node, parentId)) return false;
  return true;
}

export function moveNode(nodes: StoredNode[], id: string, parentId: string | null): StoredNode[] {
  if (!canMove(nodes, id, parentId)) throw new Error('不能把目录移进自己里面');
  const current = findNode(nodes, id);
  if (current && current.parentId === parentId) return nodes;
  const { nodes: without, removed } = removeNode(nodes, id);
  if (!removed) throw new Error('找不到要移动的项');
  return insertNode(without, parentId, removed);
}

export function collectConnections(nodes: StoredNode[], folderId: string | null): StoredConnection[] {
  const scope = folderId === null ? nodes : childrenOf(nodes, folderId);
  const found: StoredConnection[] = [];
  const walk = (list: StoredNode[]) => {
    for (const node of list) {
      if (node.type === 'connection') found.push(node);
      else walk(node.children);
    }
  };
  walk(scope);
  return found;
}

function childrenOf(nodes: StoredNode[], folderId: string): StoredNode[] {
  const found = findNode(nodes, folderId);
  if (!found || found.node.type !== 'folder') return [];
  return found.node.children;
}

export function folderOptions(nodes: StoredNode[]): { id: string; name: string; depth: number }[] {
  const options: { id: string; name: string; depth: number }[] = [];
  const walk = (list: StoredNode[], depth: number) => {
    for (const node of list) {
      if (node.type !== 'folder') continue;
      options.push({ id: node.id, name: node.name, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return options;
}

export function connectionsInNode(node: StoredNode): StoredConnection[] {
  if (node.type === 'connection') return [node];
  return node.children.flatMap(connectionsInNode);
}

export function filterPublicTree(nodes: PublicNode[], query: string): PublicNode[] {
  const text = query.trim().toLowerCase();
  if (!text) return nodes;
  const walk = (list: PublicNode[]): PublicNode[] => {
    const next: PublicNode[] = [];
    for (const node of list) {
      if (node.type === 'folder') {
        const children = walk(node.children);
        if (children.length > 0 || node.name.toLowerCase().includes(text)) {
          next.push({ ...node, children });
        }
      } else if (
        node.name.toLowerCase().includes(text) ||
        node.host.toLowerCase().includes(text) ||
        node.username.toLowerCase().includes(text)
      ) {
        next.push(node);
      }
    }
    return next;
  };
  return walk(nodes);
}

export function findPublic(nodes: PublicNode[], id: string): PublicNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === 'folder') {
      const nested = findPublic(node.children, id);
      if (nested) return nested;
    }
  }
  return null;
}

export function findParentId(nodes: PublicNode[], id: string, parentId: string | null = null): string | null | undefined {
  for (const node of nodes) {
    if (node.id === id) return parentId;
    if (node.type === 'folder') {
      const nested = findParentId(node.children, id, node.id);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}
