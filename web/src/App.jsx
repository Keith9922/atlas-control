import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import VNCViewer from './pages/VNCViewer';
import Projects from './pages/Projects';

const { Header, Content } = Layout;

export default function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header style={{ background: '#001529', padding: '0 24px', color: '#fff', fontSize: 18 }}>
          Atlas 控制中心
        </Header>
        <Content style={{ padding: '24px', background: '#f0f2f5' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/vnc/:deviceId" element={<VNCViewer />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
