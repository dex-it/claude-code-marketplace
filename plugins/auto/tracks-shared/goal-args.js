// Главный поток может не подать done и boundary: узел берёт их из файла цели, пропуск - в degraded
const blank = (v) => !String(v || '').trim()
const fromGoal = (v, absent, section, dflt) => !blank(v) ? v : A.goal_path ? `${absent}, возьми из раздела \`## ${section}\` файла цели ${A.goal_path}` : dflt
const goalLack = [blank(A.done) && 'критерий «готово» не подан', blank(A.boundary) && 'граница не подана'].filter(Boolean)
  .map(s => `${s} в args: ${A.goal_path ? `узлы отосланы к файлу цели ${A.goal_path}` : 'файла цели нет'}`)
const ownerSide = 'Пункт критерия «готово» или границы с пометкой «ответ оператора» - сторона, выбранная оператором: расхождение источника с ним противоречием не судится и в conflicts не идёт.'
