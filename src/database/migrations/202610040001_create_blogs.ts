import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('blogs', (table) => {
    table.uuid('id').primary();
    table.uuid('author_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('title', 200).notNullable();
    table.string('slug', 220).notNullable().unique('blogs_slug_unique');
    table.string('excerpt', 500).nullable();
    table.text('content').notNullable();
    table.text('cover_url').nullable();
    table.string('status', 20).notNullable().defaultTo('draft');
    table.timestamp('published_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    table.index(['author_user_id'], 'blogs_author_user_id_index');
    table.check("status in ('draft', 'published')", [], 'blogs_status_check');
    table.check(
      "(status = 'draft' and published_at is null) or (status = 'published' and published_at is not null)",
      [],
      'blogs_publication_check',
    );
    table.check('char_length(btrim(title)) between 1 and 200', [], 'blogs_title_check');
    table.check('char_length(btrim(content)) between 1 and 50000', [], 'blogs_content_check');
    table.check(
      "char_length(slug) between 3 and 220 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'",
      [],
      'blogs_slug_check',
    );
  });

  await knex.raw("CREATE INDEX blogs_public_list_index ON blogs (published_at DESC, id DESC) WHERE deleted_at IS NULL AND status = 'published'");
  await knex.raw('CREATE INDEX blogs_manage_list_index ON blogs (created_at DESC, id DESC) WHERE deleted_at IS NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('blogs');
}
