import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Grid, Button, Drawer } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import Sidebar, { SidebarMenu } from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetail from './pages/DeviceDetail';
import Projects from './pages/Projects';
import Operations from './pages/Operations';
import VNCViewer from './pages/VNCViewer';

const { Header, Content } = Layout;

export default function App() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;       // < 768px
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 桌面端：固定侧栏 */}
      {!isMobile && <Sidebar />}

      <Layout>
        <Header style={{
          background: '#001529',
          padding: isMobile ? '0 12px' : '0 24px',
          color: '#fff',
          fontSize: isMobile ? 16 : 18,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: '#fff', fontSize: 18 }} />}
              onClick={() => setDrawerOpen(true)}
              style={{ color: '#fff' }}
            />
          )}
          <span style={{ fontWeight: 600, letterSpacing: 1 }}>
            {isMobile ? 'ATLAS' : 'Atlas 控制中心'}
          </span>
        </Header>

        <Content style={{
          padding: isMobile ? '12px' : '24px',
          background: '#f0f2f5'
        }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/device/:deviceId" element={<DeviceDetail />} />
            <Route path="/vnc/:deviceId" element={<VNCViewer />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/operations" element={<Operations />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>

      {/* 移动端：抽屉式菜单 */}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={220}
          bodyStyle={{ padding: 0, background: '#001529' }}
          headerStyle={{ display: 'none' }}
        >
          <div style={{
            height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20, fontWeight: 'bold', letterSpacing: 2,
            borderBottom: '1px solid #002140'
          }}>
            ATLAS
          </div>
          <SidebarMenu onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}
    </Layout>
  );
}
