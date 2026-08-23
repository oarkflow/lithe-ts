export function TodoForm({ form, submitLabel }: { form: any; submitLabel: any }) {
	function updateTitle(event: InputEvent) {
		form.values.title = (event.currentTarget as HTMLInputElement).value;
	}

	return <form onSubmit={form.submit} class="todo-form">
		<div class="row">
			<input
				type="text"
				value={() => form.values.title}
				onInput={updateTitle}
				aria-label="Task title"
				placeholder="What needs to be done?"
				class="input-main"
			/>
			<button type="submit" class="btn btn-primary">{submitLabel}</button>
		</div>
		{() => form.errors.title ? <span class="error-text">{form.errors.title}</span> : null}
	</form>;
}
