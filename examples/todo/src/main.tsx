import { state, computed } from '@lithe/core';
import { mount } from '@lithe/dom';
import { createForm, object, string } from '@lithe/forms';
import { createRouter, Link } from '@lithe/router';
import { createI18n } from '@lithe/i18n';
import { defineTheme } from '@lithe/style';

type Todo = { id:string; title:string; done:boolean };
type TodoForm = { title:string };

defineTheme({ color:{ accent:'#6f5cff' }, radius:{ card:'14px' } });

const i18n = createI18n({
  locale:'en',
  messages:{ en:{ title:'Lithe Zero', add:'Add task', empty:'No tasks yet.' } }
});

const todos = state<Todo[]>([
  { id:crypto.randomUUID(), title:'Inspect the reactive graph', done:false },
  { id:crypto.randomUUID(), title:'Build without npm dependencies', done:true }
]);
const remaining = computed(() => todos.filter(x => !x.done).length);

const form = createForm<TodoForm>({
  initial:{ title:'' },
  schema:object({ title:string().min(2) }),
  action(values) {
    todos.push({ id:crypto.randomUUID(), title:values.title, done:false });
    form.reset();
  }
});

function Home() {
  return <main>
    <header>
      <div><h1>{() => i18n.t('title')}</h1><small>Zero dependencies · direct DOM · fine-grained reactivity</small></div>
      <Link to="/about">About</Link>
    </header>
    <section class="card">
      <form onSubmit={form.submit} class="row">
        <input value={() => form.values.title} onInput={(event:InputEvent) => form.values.title=(event.currentTarget as HTMLInputElement).value} aria-label="Task title" placeholder="New task" />
        <button type="submit">{() => i18n.t('add')}</button>
      </form>
      <small>{() => form.errors.title || `${remaining.value} remaining`}</small>
      <ul>
        {() => todos.length ? todos.map(todo => <li key={todo.id}>
          <input type="checkbox" checked={() => todo.done} onChange={(event:Event) => todo.done=(event.currentTarget as HTMLInputElement).checked} aria-label={`Toggle ${todo.title}`} />
          <span class={() => ({done:todo.done})}>{todo.title}</span>
          <button onClick={() => { const i=todos.findIndex(x=>x.id===todo.id); if(i>=0) todos.splice(i,1); }} aria-label={`Delete ${todo.title}`}>Delete</button>
        </li>) : <li>{() => i18n.t('empty')}</li>}
      </ul>
    </section>
  </main>;
}

function About() {
  return <main><h1>About</h1><p>This page is rendered by Lithe's built-in router.</p><Link to="/">Back</Link></main>;
}

const router = createRouter({ routes:[
  { path:'/', component:Home },
  { path:'/about', component:About }
]});
router.start();
mount(document.getElementById('app'), <router.View/>);
