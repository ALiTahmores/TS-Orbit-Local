import React from 'react';
import { useProject } from '../../context/ProjectContext';

// 1. TABLE CONTAINER
export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  id: string;
}

export const Table: React.FC<TableProps> = ({ id, children, className = '', ...props }) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  return (
    <div className="w-full overflow-x-auto border border-border-primary rounded-radius-16 bg-surface-primary shadow-sm font-sans">
      <table
        id={id}
        className={`w-full min-w-[500px] border-collapse text-right text-xs text-text-secondary select-none ${className}`}
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
        {...props}
      >
        {children}
      </table>
    </div>
  );
};

// 2. TABLE HEAD
export const TableHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <thead
      className={`bg-surface-secondary/50 border-b border-border-primary text-[10px] font-extrabold text-text-primary tracking-wider uppercase ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
};

// 3. TABLE ROW
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isInteractive?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  isInteractive = false,
  className = '',
  ...props
}) => {
  return (
    <tr
      className={`border-b border-border-primary last:border-0 transition-colors
        ${isInteractive ? 'hover:bg-hover-overlay cursor-pointer' : ''}
        ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
};

// 4. TABLE CELL
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  isHeader?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  isHeader = false,
  className = '',
  ...props
}) => {
  const baseStyle = 'px-6 py-4 font-medium align-middle whitespace-nowrap';
  
  if (isHeader) {
    return (
      <th className={`${baseStyle} text-[10px] font-extrabold text-text-secondary ${className}`} {...props}>
        {children}
      </th>
    );
  }

  return (
    <td className={`${baseStyle} text-text-primary ${className}`} {...props}>
      {children}
    </td>
  );
};

// 5. UNORDERED LIST
export interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  id: string;
}

export const List: React.FC<ListProps> = ({ id, children, className = '', ...props }) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  return (
    <ul
      id={id}
      className={`flex flex-col border border-border-primary rounded-radius-16 bg-surface-primary shadow-sm font-sans overflow-hidden ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
      {...props}
    >
      {children}
    </ul>
  );
};

// 6. LIST ITEM
export interface ListItemProps extends React.HTMLAttributes<HTMLLIElement> {
  isInteractive?: boolean;
}

export const ListItem: React.FC<ListItemProps> = ({
  children,
  isInteractive = false,
  className = '',
  ...props
}) => {
  return (
    <li
      className={`px-5 py-4 border-b border-border-primary last:border-0 flex items-center justify-between text-xs transition-colors
        ${isInteractive ? 'hover:bg-hover-overlay cursor-pointer' : ''}
        ${className}`}
      {...props}
    >
      {children}
    </li>
  );
};
