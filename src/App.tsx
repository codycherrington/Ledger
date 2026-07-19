import { Route, Routes } from 'react-router-dom'
import Home from './routes/Home'
import Board from './routes/Board'
import FolderBoard from './routes/FolderBoard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/project/:projectId" element={<Board />} />
      <Route path="/folder/:folderId" element={<FolderBoard />} />
    </Routes>
  )
}

export default App
