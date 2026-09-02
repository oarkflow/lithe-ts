import { signal, state } from '@oarkflow/lithe/core';
import { infiniteQuery, mutation } from '@oarkflow/lithe/data';
import { Link } from '@oarkflow/lithe/router';
import { Panel } from '../components/Panel.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

interface Article {
	id: number;
	title: string;
	excerpt: string;
	author: string;
	createdAt: string;
	tags: string[];
}

// Mock paginated API
const mockArticles: Article[] = Array.from({ length: 50 }, (_, i) => ({
	id: i + 1,
	title: [
		'Understanding Fine-Grained Reactivity',
		'Zero-Dependency Architecture Patterns',
		'Signal-Based State Management',
		'Compiler-First Framework Design',
		'Native ESM Production Builds',
		'Hydration Without Re-Rendering',
		'CRDT for Local-First Apps',
		'Web Animations API Deep Dive',
		'Accessibility in Component Libraries',
		'TypeScript Without a Build Step'
	][i % 10],
	excerpt: `This is article ${i + 1} about modern web development techniques and patterns.`,
	author: ['Alice', 'Bob', 'Charlie', 'Diana'][i % 4],
	createdAt: new Date(Date.now() - i * 3600000).toISOString(),
	tags: [['reactive', 'signals'], ['architecture', 'zero-dep'], ['typescript', 'compiler'], ['performance', 'bundle']][i % 4]
}));

async function mockFetchArticles(pageParam: number): Promise<{ articles: Article[]; nextPage: number | null }> {
	await new Promise(r => setTimeout(r, 600));
	const pageSize = 10;
	const start = (pageParam - 1) * pageSize;
	const articles = mockArticles.slice(start, start + pageSize);
	return {
		articles,
		nextPage: start + pageSize < mockArticles.length ? pageParam + 1 : null
	};
}

export function InfiniteScroll() {
	const selectedTag = signal<string | null>(null);

	const articlesQuery = infiniteQuery({
		key: ['articles-infinite'],
		initialPageParam: 1,
		queryFn: async (ctx: { pageParam: number; signal: AbortSignal }) => {
			return mockFetchArticles(ctx.pageParam);
		},
		getNextPageParam: (lastPage: any) => lastPage.nextPage
	});

	const addMutation = mutation({
		mutationFn: async (title: string) => {
			await new Promise(r => setTimeout(r, 300));
			const article: Article = {
				id: Date.now(),
				title,
				excerpt: 'New article added via mutation',
				author: 'You',
				createdAt: new Date().toISOString(),
				tags: ['new']
			};
			mockArticles.unshift(article);
			return article;
		},
		onSuccess() {
			return articlesQuery.refresh();
		}
	});

	const allArticles = () => {
		const pages = articlesQuery.pages;
		return pages.flatMap((p: any) => p.articles || []);
	};

	const filteredArticles = () => {
		const articles = allArticles();
		const tag = selectedTag.value;
		if (!tag) return articles;
		return articles.filter((a: Article) => a.tags.includes(tag));
	};

	const allTags = () => {
		const articles = allArticles();
		const tags = new Set<string>();
		articles.forEach((a: Article) => a.tags.forEach(t => tags.add(t)));
		return [...tags].sort();
	};

	const draft = state({ input: '' });

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (draft.input.trim()) {
			addMutation.mutate(draft.input.trim());
			draft.input = '';
		}
	}

	return <main class="page-container">
		<header class="app-header">
			<div class="header-branding">
				<h1>♾️ Infinite Scroll & Pagination</h1>
				<small class="tagline">Demonstrating <code>infiniteQuery()</code> with abort control and lazy page loading</small>
			</div>
			<div class="header-nav">
				<Link to="/" class="nav-link">🏠 Tasks</Link>
				<Link to="/remote" class="nav-link">☁️ Remote</Link>
				<ThemeToggle />
			</div>
		</header>

		<div class="infinite-grid">
			{/* Controls */}
			<Panel className="infinite-controls">
				<div class="controls-row">
					<div class="status-group">
						<span class="status-pill">
							{() => `Pages loaded: ${articlesQuery.pages.length}`}
						</span>
						<span class="status-pill">
							{() => `Articles: ${allArticles().length}`}
						</span>
						<span class={() => `status-pill ${articlesQuery.loading ? 'loading' : ''}`}>
							{() => articlesQuery.loading ? '⏳ Loading...' : '✅ Ready'}
						</span>
						<span class={`status-pill ${articlesQuery.hasNext ? 'has-more' : 'done'}`}>
							{() => articlesQuery.hasNext ? '📄 More pages available' : '🏁 All loaded'}
						</span>
					</div>

					<div class="action-group">
						<button
							type="button"
							class="btn btn-sm btn-outline"
							onClick={() => articlesQuery.refresh()}
							disabled={() => articlesQuery.loading}
						>
							🔄 Refresh All
						</button>
						<button
							type="button"
							class="btn btn-sm btn-primary"
							onClick={() => articlesQuery.fetchNext()}
							disabled={() => !articlesQuery.hasNext || articlesQuery.loading}
						>
							{() => articlesQuery.loading ? 'Loading...' : '📄 Load Next Page'}
						</button>
					</div>
				</div>

				{/* Tag Filter */}
				<div class="tag-filter">
					<span class="filter-label">Filter by tag:</span>
					<button
						type="button"
						class={() => `filter-btn ${!selectedTag.value ? 'active' : ''}`}
						onClick={() => selectedTag.value = null}
					>
						All
					</button>
					{() => allTags().map(tag => (
						<button
							type="button"
							key={tag}
							class={() => `filter-btn ${selectedTag.value === tag ? 'active' : ''}`}
							onClick={() => selectedTag.value = tag}
						>
							#{tag}
						</button>
					))}
				</div>
			</Panel>

			{/* Add Article Form */}
			<Panel className="infinite-form">
				<form onSubmit={handleSubmit} class="row">
					<input
						type="text"
						placeholder="Add a new article..."
						value={() => draft.input}
						onInput={(e: InputEvent) => draft.input = (e.currentTarget as HTMLInputElement).value}
						class="input-main"
					/>
					<button
						type="submit"
						class="btn btn-primary"
						disabled={() => addMutation.loading || !draft.input.trim()}
					>
						{() => addMutation.loading ? 'Adding...' : 'Add Article'}
					</button>
				</form>
			</Panel>

			{/* Articles List */}
			<Panel className="infinite-list">
				{() => {
					if (articlesQuery.error) {
						return <div class="error-box">❌ Error: {String(articlesQuery.error)}</div>;
					}

					const articles = filteredArticles();

					if (articles.length === 0 && !articlesQuery.loading) {
						return <div class="empty-state">No articles found.</div>;
					}

					return <div class="articles-grid">
						{articles.map((article: Article) => (
							<article key={article.id} class="article-card">
								<div class="article-header">
									<span class="article-id">#{article.id}</span>
									<span class="article-date">{new Date(article.createdAt).toLocaleDateString()}</span>
								</div>
								<h2 class="article-title">{article.title}</h2>
								<p class="article-excerpt">{article.excerpt}</p>
								<div class="article-footer">
									<span class="article-author">By {article.author}</span>
									<div class="article-tags">
										{article.tags.map(tag => (
											<span key={tag} class="tag-chip">#{tag}</span>
										))}
									</div>
								</div>
							</article>
						))}
					</div>;
				}}

				{/* Load More Button */}
				{() => articlesQuery.hasNext ? (
					<div class="load-more">
						<button
							type="button"
							class="btn btn-outline btn-lg"
							onClick={() => articlesQuery.fetchNext()}
							disabled={() => articlesQuery.loading}
						>
							{() => articlesQuery.loading ? '⏳ Loading next page...' : `📄 Load More (${allArticles().length} of ${mockArticles.length})`}
						</button>
					</div>
				) : allArticles().length > 0 ? (
					<div class="all-loaded">✅ All articles loaded!</div>
				) : null}
			</Panel>

			{/* Abort Control Info */}
			<Panel className="infinite-info">
				<h2>🛡️ Abort Control</h2>
				<p>When a new page fetch starts, the previous in-flight request is automatically aborted. This prevents race conditions and wasted bandwidth.</p>
				<div class="info-features">
					<div class="info-item">
						<span class="info-icon">⚡</span>
						<span>Each page fetch receives an <code>AbortSignal</code></span>
					</div>
					<div class="info-item">
						<span class="info-icon">🔄</span>
						<span>Rapid page loads cancel stale requests</span>
					</div>
					<div class="info-item">
						<span class="info-icon">💾</span>
						<span>Completed pages are cached independently</span>
					</div>
				</div>
			</Panel>
		</div>
	</main>;
}
