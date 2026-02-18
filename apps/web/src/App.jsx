import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Game from "./pages/Game";
import QuizEdit from "./pages/QuizEdit";
import TV from "./pages/TV";

export default function App() {
  return (
    <Routes>
      <Route path="/tv" element={<TV />} />
      <Route path="/tv/:quizId" element={<TV />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="quiz/:id/edit" element={<QuizEdit />} />
        <Route path="game/:id" element={<Game />} />
      </Route>
    </Routes>
  );
}
