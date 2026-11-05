import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { debounceTime, merge } from 'rxjs';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolSelect, ToolTextarea } from '../../../../../ui/tool-kit/tool-fields';
import { controlSignal, toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { formatBytes } from '../../../tool-logic-2';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { downloadText } from '../dev-utils';
import { PLACEHOLDER_STYLES, SQL_DIALECTS, formatSql, minifySql, type PlaceholderStyle, type SqlDialect, type SqlFormatOptions } from './sql-logic';

const MODES: NavTab[] = [
  { label: 'Format', value: 'format' },
  { label: 'Minify', value: 'minify' },
];

const KEYWORD_CASES = [
  { id: 'upper', name: 'UPPER CASE' },
  { id: 'lower', name: 'lower case' },
  { id: 'preserve', name: 'Keep as typed' },
];
const INDENTS = [
  { id: '2', name: '2 spaces' },
  { id: '4', name: '4 spaces' },
  { id: 'tab', name: 'Tab' },
];
const COMMAS = [
  { id: 'trailing', name: 'End of line (a,)' },
  { id: 'leading', name: 'Start of line (, a)' },
];
const OPERATORS = [
  { id: 'before', name: 'Before the line (AND x)' },
  { id: 'after', name: 'After the line (x AND)' },
];
const BLANK_LINES = [
  { id: '0', name: 'None' },
  { id: '1', name: 'One' },
  { id: '2', name: 'Two' },
];

const SAMPLE = `select u.id,u.email,count(o.id) as orders,coalesce(sum(o.total),0) total from users u left join orders o on o.user_id=u.id and o.status in ('paid','shipped') where u.created_at>=$1 and (u.country='PK' or u.country='AE') group by u.id,u.email having count(o.id)>2 order by total desc limit 50; -- top buyers
update users set last_seen=now() where id=$2;`;

/** /tools/sql-formatter: formats or minifies SQL for eight dialects. Formatting only: nothing is run or validated. */
@Component({
  selector: 'app-sql-formatter',
  imports: [ToolLayout, ToolPanel, ToolTextarea, ToolSelect, ToolOutput, ToolNote, ToolEmpty, ToolButton, TabsComponent],
  styleUrl: '../../../tool-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="sql-formatter">
      <div class="tool-split">
        <app-tool-panel title="SQL">
          <ng-container ngProjectAs="[panelActions]">
            <app-tool-button size="small" icon="wand-sparkles" label="Load sample" (pressed)="sourceCtl.setValue(sample)" />
            <app-tool-button size="small" icon="eraser" label="Clear" [disabled]="!source()" (pressed)="sourceCtl.setValue('')" />
          </ng-container>
          <app-tool-textarea fieldId="sql-input" label="SQL to format" placeholder="select * from users where id = 1" [control]="sourceCtl" [rows]="12" [invalid]="!!error()" />
          <div role="group" aria-label="Action">
            <app-custom-tabs [tabs]="modes" [activeTab]="mode()" (activeTabChange)="setMode($event)" />
          </div>
          <div class="tool-controls">
            <app-tool-select fieldId="sql-dialect" label="Dialect" [control]="dialectCtl" [options]="dialects" />
            @if (mode() === 'format') {
              <app-tool-select fieldId="sql-case" label="Keywords" [control]="caseCtl" [options]="keywordCases" />
              <app-tool-select fieldId="sql-indent" label="Indent" [control]="indentCtl" [options]="indents" />
              <app-tool-select fieldId="sql-comma" label="Commas" [control]="commaCtl" [options]="commas" />
              <app-tool-select fieldId="sql-operator" label="AND / OR" [control]="operatorCtl" [options]="operators" />
              <app-tool-select fieldId="sql-blank" label="Blank lines between statements" [control]="blankCtl" [options]="blankLines" />
              <app-tool-select fieldId="sql-params" label="Placeholders" [control]="paramsCtl" [options]="placeholders" hint="How placeholders such as ?, $1, :name, @name and double braces are recognised" />
            }
          </div>
        </app-tool-panel>

        <app-tool-panel title="Result">
          @if (error(); as err) {
            <app-tool-note kind="error">{{ err }}</app-tool-note>
          } @else if (output(); as out) {
            <app-tool-output
              [label]="mode() === 'format' ? 'Formatted SQL' : 'Minified SQL'"
              [meta]="meta()"
              [value]="out"
              copyLabel="Copy SQL"
              (copied)="trackCopy()"
            />
            <div class="tool-actions">
              <app-tool-button size="small" icon="download" label="Download .sql" (pressed)="download()" />
            </div>
            <app-tool-note kind="info">
              This only changes layout. It does not check that tables, columns or functions exist, and it never runs the query. Review formatted output before committing it.
            </app-tool-note>
          } @else {
            <app-tool-empty icon="database">Paste SQL on the left, or load the sample. Pick the dialect that matches your database for the best result.</app-tool-empty>
          }
        </app-tool-panel>
      </div>
    </app-tool-layout>
  `,
})
export class SqlFormatterTool {
  private readonly markUsed = toolUsage('sql-formatter');
  protected readonly trackCopy = toolCopied('sql-formatter');
  private readonly trackDownload = toolCopied('sql-formatter', { method: 'download' });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sample = SAMPLE;
  protected readonly modes = MODES;
  protected readonly dialects = SQL_DIALECTS;
  protected readonly keywordCases = KEYWORD_CASES;
  protected readonly indents = INDENTS;
  protected readonly commas = COMMAS;
  protected readonly operators = OPERATORS;
  protected readonly blankLines = BLANK_LINES;
  protected readonly placeholders = PLACEHOLDER_STYLES;

  protected readonly mode = signal<'format' | 'minify'>('format');
  protected readonly sourceCtl = new FormControl('', { nonNullable: true });
  protected readonly dialectCtl = new FormControl('postgresql', { nonNullable: true });
  protected readonly caseCtl = new FormControl('upper', { nonNullable: true });
  protected readonly indentCtl = new FormControl('2', { nonNullable: true });
  protected readonly commaCtl = new FormControl('trailing', { nonNullable: true });
  protected readonly operatorCtl = new FormControl('before', { nonNullable: true });
  protected readonly blankCtl = new FormControl('1', { nonNullable: true });
  protected readonly paramsCtl = new FormControl('auto', { nonNullable: true });
  protected readonly source = controlSignal(this.sourceCtl);

  protected readonly output = signal('');
  protected readonly error = signal('');
  private run = 0;

  protected readonly meta = computed(() => {
    const out = this.output();
    const lines = out ? out.split('\n').length : 0;
    return `${lines} ${lines === 1 ? 'line' : 'lines'} · ${formatBytes(new TextEncoder().encode(out).length)}`;
  });

  constructor() {
    merge(
      this.sourceCtl.valueChanges,
      this.dialectCtl.valueChanges,
      this.caseCtl.valueChanges,
      this.indentCtl.valueChanges,
      this.commaCtl.valueChanges,
      this.operatorCtl.valueChanges,
      this.blankCtl.valueChanges,
      this.paramsCtl.valueChanges,
    )
      .pipe(debounceTime(200), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.process());
  }

  protected setMode(value: string): void {
    this.mode.set(value === 'minify' ? 'minify' : 'format');
    void this.process();
  }

  protected download(): void {
    downloadText('query.sql', `${this.output()}\n`, 'application/sql');
    this.trackDownload();
  }

  private options(): SqlFormatOptions {
    const indent = this.indentCtl.value;
    return {
      dialect: this.dialectCtl.value as SqlDialect,
      keywordCase: this.caseCtl.value as SqlFormatOptions['keywordCase'],
      indent: indent === 'tab' ? 'tab' : indent === '4' ? 4 : 2,
      commaPosition: this.commaCtl.value as SqlFormatOptions['commaPosition'],
      linesBetweenQueries: Number(this.blankCtl.value),
      placeholders: this.paramsCtl.value as PlaceholderStyle,
      expressionWidth: 50,
      logicalOperatorNewline: this.operatorCtl.value as SqlFormatOptions['logicalOperatorNewline'],
    };
  }

  private async process(): Promise<void> {
    const run = ++this.run;
    const sql = this.sourceCtl.value;
    if (!sql.trim()) {
      this.output.set('');
      this.error.set('');
      return;
    }
    if (this.mode() === 'minify') {
      this.output.set(minifySql(sql, this.dialectCtl.value as SqlDialect));
      this.error.set('');
      this.markUsed();
      return;
    }
    const result = await formatSql(sql, this.options());
    if (run !== this.run) return;
    if (result.ok) {
      this.output.set(result.sql);
      this.error.set('');
      this.markUsed();
    } else {
      this.output.set('');
      this.error.set(result.error);
    }
  }
}
