import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  DesktopOutlined,
  ProjectOutlined,
  SettingOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/devices', icon: <DesktopOutlined />, label: '设备管理' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Sider breakpoint="lg" collapsedWidth="0" style={{ background: '#001529' }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 'bold' }}>
        ATLAS
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  );
}
