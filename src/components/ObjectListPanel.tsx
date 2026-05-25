import { Eye, EyeOff, Search, Trash2 } from "lucide-react";

export interface ObjectListItem {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly searchText: string;
  readonly visible: boolean;
  readonly selected: boolean;
}

export interface ObjectListGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly ObjectListItem[];
}

interface ObjectListPanelProps {
  readonly groups: readonly ObjectListGroup[];
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onSelect: (id: string) => void;
  readonly onToggleVisible: (id: string, visible: boolean) => void;
  readonly onDelete: (id: string) => void;
}

function ObjectListPanel({
  groups,
  searchQuery,
  onSearchQueryChange,
  onSelect,
  onToggleVisible,
  onDelete,
}: ObjectListPanelProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: normalizedQuery
        ? group.items.filter((item) =>
            `${group.label} ${item.searchText}`.toLowerCase().includes(
              normalizedQuery,
            ),
          )
        : group.items,
    }))
    .filter((group) => group.items.length > 0);

  return (
    <section className="object-list-panel" aria-label="对象列表">
      <label className="object-list-search">
        <Search size={15} aria-hidden="true" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="搜索对象"
        />
      </label>
      <div className="object-list-scroll">
        {filteredGroups.length > 0 ? (
          filteredGroups.map((group) => (
            <section className="object-list-group" key={group.id}>
              <h3>{group.label}</h3>
              <ul>
                {group.items.map((item) => (
                  <li
                    className={
                      item.selected
                        ? "object-list-row selected"
                        : "object-list-row"
                    }
                    key={item.id}
                  >
                    <button
                      aria-label={item.visible ? "隐藏对象" : "显示对象"}
                      className="object-list-icon-button"
                      onClick={() => onToggleVisible(item.id, !item.visible)}
                      type="button"
                    >
                      {item.visible ? (
                        <Eye size={15} aria-hidden="true" />
                      ) : (
                        <EyeOff size={15} aria-hidden="true" />
                      )}
                    </button>
                    <button
                      className="object-list-name-button"
                      onClick={() => onSelect(item.id)}
                      type="button"
                    >
                      <span className="object-list-name">{item.name}</span>
                      <span className="object-list-detail">{item.detail}</span>
                    </button>
                    <button
                      aria-label="删除对象"
                      className="object-list-icon-button danger"
                      onClick={() => onDelete(item.id)}
                      type="button"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <div className="empty-state">暂无对象。</div>
        )}
      </div>
    </section>
  );
}

export default ObjectListPanel;
