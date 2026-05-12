import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  DesktopOutlined,
  ProjectOutlined,
  HistoryOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const menuItems = [
  { key: '/',           icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/devices',    icon: <DesktopOutlined />,   label: '设备管理' },
  { key: '/projects',   icon: <ProjectOutlined />,   label: '项目管理' },
  { key: '/operations', icon: <HistoryOutlined />,   label: '操作历史' },
];

// 桌面端整套侧栏（含 logo）
export default function Sidebar() {
  return (
    <Sider style={{ background: '#001529' }} width={200}>
      <div style={{
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 20, fontWeight: 'bold', letterSpacing: 2
      }}>
        ATLAS
      </div>
      <SidebarMenu />
    </Sider>
  );
}

// 仅菜单部分，便于 Drawer 复用
export function SidebarMenu({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();

  const selected = location.pathname.startsWith('/device/') ? '/devices'
                 : location.pathname.startsWith('/vnc/')    ? '/devices'
                 : location.pathname;

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selected]}
      items={menuItems}
      onClick={({ key }) => {
        navigate(key);
        onNavigate?.();
      }}
      style={{ background: '#001529', borderRight: 0 }}
    />
  );
}
