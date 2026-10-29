import { describe, expect, it } from 'vitest';
import { createId } from '../src/core/ids';
import type { StoredConnection, StoredFolder, StoredNode } from '../src/shared/types';
import {
  canMove,
  collectConnections,
  filterPublicTree,
  findParentId,
  insertNode,
  moveNode,
  removeNode,
  renameNode,
} from '../src/shared/tree';
import { validateConnection, validateFolderName } from '../src/shared/validate';

function folder(name: string, children: StoredNode[] = []): StoredFolder {
  return { type: 'folder', id: createId('f'), name, children };
}
function conn(name: string): StoredConnection {
  return {
    type: 'connection',
    id: createId('c'),
    name,
    host: '10.0.0.1',
    port: 22,
    username: 'root',
    authType: 'password',
    saveSecret: false,
    legacyAlgorithms: false,
    passphraseRequired: false,
  };
}

describe('连接目录', () => {
  it('按目录收集全部连接，包含子目录', () => {
    const storage = folder('存储服务器', [conn('nas-01'), folder('冷备', [conn('nas-02')])]);
    const compute = folder('计算节点', [conn('gpu-01')]);
    const all = collectConnections([storage, compute], storage.id);
    expect(all.map((item) => item.name)).toEqual(['nas-01', 'nas-02']);
  });

  it('不能把目录移进自己或子目录', () => {
    const child = folder('冷备');
    const storage = folder('存储服务器', [child]);
    const tree = [storage];
    expect(canMove(tree, storage.id, child.id)).toBe(false);
    expect(canMove(tree, storage.id, storage.id)).toBe(false);
    expect(() => moveNode(tree, storage.id, child.id)).toThrow(/不能把目录移进自己/);
  });

  it('可以把连接移动到另一个目录', () => {
    const one = conn('nas-01');
    const storage = folder('存储服务器', [one]);
    const compute = folder('计算节点');
    const moved = moveNode([storage, compute], one.id, compute.id);
    expect(collectConnections(moved, compute.id).map((item) => item.name)).toEqual(['nas-01']);
    expect(collectConnections(moved, storage.id)).toEqual([]);
  });

  it('删除目录时带走里面的连接', () => {
    const one = conn('nas-01');
    const storage = folder('存储服务器', [one]);
    const { nodes, removed } = removeNode([storage], storage.id);
    expect(nodes).toEqual([]);
    expect(removed?.type).toBe('folder');
  });

  it('重命名、插入，并记住父目录', () => {
    const storage = folder('存储');
    let tree = insertNode([], null, storage);
    const one = conn('nas-01');
    tree = insertNode(tree, storage.id, one);
    tree = renameNode(tree, storage.id, '存储服务器');
    expect(findParentId(tree, one.id)).toBe(storage.id);
    expect(tree[0]?.name).toBe('存储服务器');
  });

  it('筛选主机和用户名', () => {
    const one = { ...conn('nas-01'), host: 'nas.local', username: 'backup' };
    const tree = [folder('存储服务器', [one])];
    expect(filterPublicTree(tree, 'backup')).toHaveLength(1);
    expect(filterPublicTree(tree, '没有')).toEqual([]);
  });

  it('校验名称、主机和端口', () => {
    expect(validateFolderName('  ')).toMatch(/目录名/);
    expect(validateConnection({ name: 'a', host: ' [10.0.0.1] ', port: 0, username: 'root', authType: 'password' })).toMatch(/端口/);
    expect(validateConnection({ name: 'a', host: '10.0.0.1', port: 22, username: 'root', authType: 'password' })).toBeNull();
  });
});
