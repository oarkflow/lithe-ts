export function TodoForm({ form, submitLabel }: { form: any; submitLabel: any }) {
	function updateTitle(event: InputEvent) { form.values.title = (event.currentTarget as HTMLInputElement).value; }
	return <form onSubmit={form.submit} class="row">
		<input value={() => form.values.title} onInput={updateTitle} aria-label="Task title" placeholder="New task" />
		<button type="submit">{submitLabel}</button>
	</form>;
}
