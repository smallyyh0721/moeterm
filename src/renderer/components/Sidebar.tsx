import { useRef, useState, type MouseEvent, type MutableRefObject } from 'react';
import type { PublicConnection, PublicNode } from '../../shared/types';
import { filterPublicTree } from '../../shared/tree';

export function Sidebar({
  tree,
  width,
  selectedId,
  connectedIds,
  connectingIds,
  onSelect,
  onConnect,
  onOpenAll,
  onSftp,
  onEdit,
  onDuplicate,
  onDelete,
  onRename,
  onCreateFolder,
  onCreateConnection,
  onMove,
}: {
  tree: PublicNode[];
  width: number;
  selectedId: string | null;
  connectedIds: Set<string>;
  connectingIds: Set<string>;
  onSelect: (id: string) => void;
  onConnect: (connection: PublicConnection) => void;
  onOpenAll: (folderId: string) => void;
  onSftp: (connection: PublicConnection) => void;
  onEdit: (connection: PublicConnection) => void;
  onDuplicate: (id: string) => void;
  onDelete: (node: PublicNode) => void;
  onRename: (node: PublicNode) => void;
  onCreateFolder: (parentId: string | null) => void;
  onCreateConnection: (parentId: string | null) => void;
  onMove: (id: string, parentId: string | null) => void;
}) {
  const [filter, setFilter] = useState('');
  const [menu, setMenu] = useState<{ x: number; y: number; node: PublicNode } | null>(null);
  const dragId = useRef<string | null>(null);
  const shown = filterPublicTree(tree, filter);

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="side-head">连接</div>
      <input className="side-filter" placeholder="筛选名称或主机" value={filter} onChange={(event) => setFilter(event.target.value)} />
      <div
        className="tree"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          if (event.target !== event.currentTarget) return;
          const id = dragId.current;
          dragId.current = null;
          if (id) onMove(id, null);
        }}
        onContextMenu={(event) => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
        }}
      >
        {shown.length === 0 ? <div className="empty">还没有连接。先建一个目录，比如「存储服务器」。</div> : null}
        {shown.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            depth={0}
            parentId={null}
            selectedId={selectedId}
            connectedIds={connectedIds}
            connectingIds={connectingIds}
            dragId={dragId}
            onSelect={onSelect}
            onConnect={onConnect}
            onOpenAll={onOpenAll}
            onMenu={(event, item) => {
              event.preventDefault();
              setMenu({ x: event.clientX, y: event.clientY, node: item });
            }}
            onMove={onMove}
          />
        ))}
      </div>
      <div className="side-actions">
        <button type="button" className="btn" onClick={() => onCreateFolder(null)}>
          新建目录
        </button>
        <button type="button" className="btn primary" onClick={() => onCreateConnection(null)}>
          新建连接
        </button>
      </div>
      {menu ? (
        <div className="menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(event) => event.stopPropagation()}>
          {menu.node.type === 'folder' ? (
            <>
              <button type="button" onClick={() => { onOpenAll(menu.node.id); setMenu(null); }}>打开全部连接</button>
              <button type="button" onClick={() => { onCreateConnection(menu.node.id); setMenu(null); }}>新建连接</button>
              <button type="button" onClick={() => { onCreateFolder(menu.node.id); setMenu(null); }}>新建子目录</button>
              <button type="button" onClick={() => { onRename(menu.node); setMenu(null); }}>重命名</button>
              <button type="button" onClick={() => { onDelete(menu.node); setMenu(null); }}>删除</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { onConnect(menu.node as PublicConnection); setMenu(null); }}>连接</button>
              <button type="button" onClick={() => { onSftp(menu.node as PublicConnection); setMenu(null); }}>打开 SFTP</button>
              <button type="button" onClick={() => { onEdit(menu.node as PublicConnection); setMenu(null); }}>编辑</button>
              <button type="button" onClick={() => { onDuplicate(menu.node.id); setMenu(null); }}>复制</button>
              <button type="button" onClick={() => { onRename(menu.node); setMenu(null); }}>重命名</button>
              <button type="button" onClick={() => { onDelete(menu.node); setMenu(null); }}>删除</button>
            </>
          )}
        </div>
      ) : null}
      {menu ? <div className="menu-catch" onMouseDown={() => setMenu(null)} /> : null}
    </aside>
  );
}

function TreeRow({
  node,
  depth,
  parentId,
  selectedId,
  connectedIds,
  connectingIds,
  dragId,
  onSelect,
  onConnect,
  onOpenAll,
  onMenu,
  onMove,
}: {
  node: PublicNode;
  depth: number;
  parentId: string | null;
  selectedId: string | null;
  connectedIds: Set<string>;
  connectingIds: Set<string>;
  dragId: MutableRefObject<string | null>;
  onSelect: (id: string) => void;
  onConnect: (connection: PublicConnection) => void;
  onOpenAll: (folderId: string) => void;
  onMenu: (event: MouseEvent, node: PublicNode) => void;
  onMove: (id: string, parentId: string | null) => void;
}) {
  const [open, setOpen] = useState(true);
  const [over, setOver] = useState(false);
  const dot = node.type === 'connection' ? (connectedIds.has(node.id) ? 'on' : connectingIds.has(node.id) ? 'wait' : '') : '';

  return (
    <div>
      <div
        className={`node ${node.type}${selectedId === node.id ? ' selected' : ''}${over ? ' over' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable
        onDragStart={() => {
          dragId.current = node.id;
        }}
        onDragEnd={() => {
          dragId.current = null;
          setOver(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOver(false);
          const id = dragId.current;
          dragId.current = null;
          if (!id || id === node.id) return;
          onMove(id, node.type === 'folder' ? node.id : parentId);
        }}
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => {
          if (node.type === 'folder') setOpen((value) => !value);
          else onConnect(node);
        }}
        onContextMenu={(event) => onMenu(event, node)}
      >
        {node.type === 'folder' ? (
          <button type="button" className="twist" onClick={() => setOpen((value) => !value)}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className={`dot ${dot}`} />
        )}
        <span className="node-name">{node.name}</span>
        {node.type === 'connection' ? <span className="node-meta">{node.username}@{node.host}</span> : null}
        {node.type === 'folder' ? (
          <button
            type="button"
            className="open-all"
            title="打开此目录下的全部连接"
            onClick={(event) => {
              event.stopPropagation();
              onOpenAll(node.id);
            }}
          >
            全部
          </button>
        ) : null}
      </div>
      {node.type === 'folder' && open
        ? node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              parentId={node.id}
              selectedId={selectedId}
              connectedIds={connectedIds}
              connectingIds={connectingIds}
              dragId={dragId}
              onSelect={onSelect}
              onConnect={onConnect}
              onOpenAll={onOpenAll}
              onMenu={onMenu}
              onMove={onMove}
            />
          ))
        : null}
    </div>
  );
}
