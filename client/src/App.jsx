import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Layout from './pages/Layout'
import Dashboard from './pages/Dashboard'
import Community from './pages/Community'
import {Toaster} from 'react-hot-toast'


const App = () => {

  return (
    <div>
      <Toaster />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/ai' element={<Layout />}>
        {/* 为什么是index:打开/ai 默认显示*/}
          <Route index element={<Dashboard />} />  
          <Route path='write-article' element={null} />
          <Route path='blog-titles' element={null}/>
          <Route path='generate-images' element={null} />
          <Route path='remove-background' element={null} />
          <Route path='remove-object' element={null} />
          <Route path='review-resume' element={null} />
          <Route path='community' element={<Community />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App
