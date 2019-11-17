import {
  AfterContentInit,
  Component,
  ContentChild,
  ContentChildren,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  TemplateRef,
  ViewChildren
} from '@angular/core';
import { DataTableColumnDirective } from '../../directives/column/column.directive';
import { DataTableRowComponent } from '../row/row.component';
import { DataTableParams } from '../../types/data-table-params.type';
import { RowCallback } from '../../types/row-callback.type';
import { DataTableTranslations } from '../../types/data-table-translations.type';
import { defaultTranslations } from '../../types/default-translations.type';
import { drag } from '../../utils/drag';

import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/do';

let nextId = 0;

@Component({
  selector: 'data-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.css']
})
export class DataTableComponent implements DataTableParams, OnInit, AfterContentInit, OnDestroy {

  private _items: any[] = [];
  private _itemCount;

  @Input()
  get items(): any[] {
    return this._items;
  }

  set items(items: any[]) {
    this._items = items;
    // no need to call notifier.next() because _onReloadFinished()
    // will change reloaded value causing notifier.next() to be called implicitly.
    this._onReloadFinished();
  }


  @Input()
  get itemCount(): number {
    return this._itemCount;
  }

  set itemCount(count: number) {
    this._itemCount = count;
    this.notifier.next();
  }

  // UI components:
  @ContentChildren(DataTableColumnDirective) columns: QueryList<DataTableColumnDirective>;
  @ViewChildren(DataTableRowComponent) rows: QueryList<DataTableRowComponent>;
  @ContentChild('dataTableExpand') expandTemplate: TemplateRef<any>;

  // One-time optional bindings with default values:
  @Input() title = '';
  @Input() showTitle = true;
  @Input() header = true;
  @Input() pagination = true;
  @Input() indexColumn = true;
  @Input() indexColumnHeader = '';
  @Input() rowColors: RowCallback;
  @Input() rowTooltip: RowCallback;
  @Input() selectColumn = false;
  @Input() multiSelect = true;
  @Input() substituteRows = true;
  @Input() expandableRows = false;
  @Input() labels: DataTableTranslations;
  @Input() selectOnRowClick = false;
  @Input() autoReload = true;
  @Input() showReloading = false;
  @Input() noDataMessage: string;
  @Input() pageLimits: number[] = [10, 25, 50, 100, 250];
  @Input() primaryColumn = '';

  // reload emitter
  @Output() reload = new EventEmitter();

  // event handlers:
  @Output() rowClick = new EventEmitter();
  @Output() rowDoubleClick = new EventEmitter();
  @Output() headerClick = new EventEmitter();
  @Output() cellClick = new EventEmitter();
  @Output() rowExpandButtonClick = new EventEmitter();
  
  // UI state without input:
  indexColumnVisible: boolean;
  selectColumnVisible: boolean;
  expandColumnVisible: boolean;

  // ada notifications.
  reloadNotification: string;
  paginationNotification: string;
  sortNotification: string;
  columnSelectorNotification: string;

  _displayParams = <DataTableParams>{}; // params of the last finished reload

  subject = new Subject<void>();
  subject$: Subscription;

  notifier = new Subject<void>();
  notifier$: Subscription;

  // selection:
  selectedRow: DataTableRowComponent;
  selectedRows: DataTableRowComponent[] = [];

  Math: any;
  id = `datatable-${nextId++}`;

  // select all checkbox flag
  private _selectAllCheckbox = false;

  // column resizing:
  private _resizeInProgress = false;

  resizeLimit = 30;

  // Reloading:
  _reloading = false;

  get reloading() {
    return this._reloading;
  }

  set reloading(val: boolean) {
    this._reloading = val;
    this.notifier.next();
  }

  // UI state: visible get/set for the outside with @Input for one-time initial values
  private _sortBy: string;

  @Input()
  get sortBy(): string {
    return this._sortBy;
  }

  set sortBy(value: string) {
    this._sortBy = value;
    this.subject.next();
  }

  private _sortAsc = true;

  @Input()
  get sortAsc(): boolean {
    return this._sortAsc;
  }

  set sortAsc(value: boolean) {
    this._sortAsc = value;
    this.subject.next();
  }

  private _offset = 0;

  @Input()
  get offset(): number {
    return this._offset;
  }

  set offset(value: number) {
    this._offset = value;
    this.subject.next();
  }

  private _limit = 10;

  @Input()
  get limit(): number {
    return this._limit;
  }

  set limit(value: number) {
    this._limit = value;
    this.subject.next();
  }

  // calculated property:
  @Input()
  get page() {
    return this.itemCount !== 0 ? Math.floor(this.offset / this.limit) + 1 : 0;
  }

  set page(value) {
    this.offset = (value - 1) * this.limit;
  }

  get lastPage() {
    return Math.ceil(this.itemCount / this.limit);
  }

  // setting multiple observable properties simultaneously
  sort(sortBy: string, asc: boolean) {
    this.sortBy = sortBy;
    this.sortAsc = asc;
  }

  // init
  ngOnInit() {
    this._initDefaultValues();
    this._initDefaultClickEvents();
    this._updateDisplayParams();

    if (this.pageLimits.indexOf(this.limit) < 0) {
      this.limit = this.pageLimits[0];
    }

    this.labels = { ...defaultTranslations, ...this.labels };

    if (this.autoReload) {
      this.reloadItems();
    }

    this.notifier$ = this.notifier.subscribe(() => this._notify());
    this.subject$ = this.subject.debounceTime(100).subscribe(() => this.reloadItems());

  }

  private _initDefaultValues() {
    this.indexColumnVisible = this.indexColumn;
    this.selectColumnVisible = this.selectColumn;
    this.expandColumnVisible = this.expandableRows;
  }

  private _initDefaultClickEvents() {
    this.headerClick.subscribe(
      (tableEvent: { column: DataTableColumnDirective, event: Event }) => this.sortColumn(tableEvent.column));
    if (this.selectOnRowClick) {
      this.rowClick.subscribe(
        (tableEvent: { row: DataTableRowComponent, event: Event }) => tableEvent.row.selected = !tableEvent.row.selected);
    }
  }

  reloadItems() {
    this.reloading = true;
    this.reload.emit(this._getRemoteParameters());
  }

  private _onReloadFinished() {
    if (this.reloading) {
      this._updateDisplayParams();
      this._selectAllCheckbox = false;
      this.reloading = false;
    }
  }
  get displayParams() {
    return this._displayParams;
  }

  _updateDisplayParams() {
    this._displayParams = {
      sortBy: this.sortBy,
      sortAsc: this.sortAsc,
      offset: this.offset,
      limit: this.limit
    };
  }

  constructor() { }

  public rowClicked(row: DataTableRowComponent, event: Event) {
    this.rowClick.emit({ row, event });
  }

  public rowDoubleClicked(row: DataTableRowComponent, event: Event) {
    this.rowDoubleClick.emit({ row, event });
  }

  public headerClicked(column: DataTableColumnDirective, event: Event) {
    if (!this._resizeInProgress) {
      event.preventDefault();
      event.stopPropagation();
      this.headerClick.emit({ column, event });
    } else {
      this._resizeInProgress = false; // this is because I can't prevent click from mousup of the drag end
    }
  }

  private cellClicked(column: DataTableColumnDirective, row: DataTableRowComponent, event: MouseEvent) {
    this.cellClick.emit({ row, column, event });
  }

  // functions:
  private _getRemoteParameters(): DataTableParams {
    const params = <DataTableParams>{};

    if (this.sortBy) {
      params.sortBy = this.sortBy;
      params.sortAsc = this.sortAsc;
    }
    if (this.pagination) {
      params.offset = this.offset;
      params.limit = this.limit;
    }
    return params;
  }

  private sortColumn(column: DataTableColumnDirective) {
    if (column.sortable) {
      const ascending = this.sortBy === column.property ? !this.sortAsc : true;
      this.sort(column.property, ascending);
    }
  }

  get columnCount() {
    let count = 0;
    count += this.indexColumnVisible ? 1 : 0;
    count += this.selectColumnVisible ? 1 : 0;
    count += this.expandColumnVisible ? 1 : 0;
    this.columns.toArray().forEach(column => {
      count += column.visible ? 1 : 0;
    });
    return count;
  }

  public getRowColor(item: any, index: number, row: DataTableRowComponent) {
    if (this.rowColors !== undefined) {
      return (<RowCallback>this.rowColors)(item, row, index);
    }
  }

  get selectAllCheckbox() {
    return this._selectAllCheckbox;
  }

  set selectAllCheckbox(value) {
    this._selectAllCheckbox = value;
    this._onSelectAllChanged(value);
  }

  private _onSelectAllChanged(value: boolean) {
    this.rows.toArray().forEach(row => row.selected = value);
  }

  onRowSelectChanged(row: DataTableRowComponent) {

    // maintain the selectedRow(s) view
    if (this.multiSelect) {
      const index = this.selectedRows.indexOf(row);
      if (row.selected && index < 0) {
        this.selectedRows.push(row);
      } else if (!row.selected && index >= 0) {
        this.selectedRows.splice(index, 1);
      }
    } else {
      if (row.selected) {
        this.selectedRow = row;
      } else if (this.selectedRow === row) {
        delete this.selectedRow;
      }
    }


    // unselect all other rows:
    if (row.selected && !this.multiSelect) {
      this.rows.toArray().filter(row_ => row_.selected).forEach(row_ => {
        if (row_ !== row) { // avoid endless loop
          row_.selected = false;
        }
      });
    }
  }


  onRowExpandButtonClicked(row: DataTableRowComponent, statusOfRow: Boolean) {
    this.rowExpandButtonClick.emit({ row: row, status: statusOfRow });
  }


  // other:

  get substituteItems() {
    return Array.from({ length: this.displayParams.limit - this.items.length });
  }

  private resizeColumnStart(event: MouseEvent, column: DataTableColumnDirective, columnElement: HTMLElement) {
    this._resizeInProgress = true;
    let startOffset = columnElement.offsetWidth - event.pageX;
    drag(event, {
      move: (moveEvent: MouseEvent, dx: number) => {
        if (this._isResizeInLimit(columnElement, dx)) {
          column.width = startOffset + moveEvent.pageX + dx;
        }
      },
    });
  }

  private _isResizeInLimit(columnElement: HTMLElement, dx: number) {
    /* This is needed because CSS min-width didn't work on table-layout: fixed.
         Without the limits, resizing can make the next column disappear completely,
         and even increase the table width. The current implementation suffers from the fact,
         that offsetWidth sometimes contains out-of-date values. */
    if ((dx < 0 && (columnElement.offsetWidth + dx) <= this.resizeLimit) ||
      !columnElement.nextElementSibling || // resizing doesn't make sense for the last visible column
      (dx >= 0 && ((<HTMLElement>columnElement.nextElementSibling).offsetWidth + dx) <= this.resizeLimit)) {
      return false;
    }
    return true;
  }

  ngAfterContentInit(): void {
    if (this.primaryColumn === '') {
      this.primaryColumn = (this.columns.first as DataTableColumnDirective).property;
    }
  }

  _notify(): void {
    const loading = this.reloading;

    this.reloadNotification = loading ?
      this.labels.loadingText.replace('{title}', this.title) :
      this.labels.loadedText.replace('{title}', this.title);

    if (!loading) {
      if (this.pagination) {
        this.paginationNotification = this.labels.paginationText
          .replace('{from}', '' + (Math.ceil(this.itemCount / this.limit) !== 0 ? this.offset + 1 : '0'))
          .replace('{to}', '' + (Math.min(this.offset + this.limit, this.itemCount)))
          .replace('{total}', '' + this.itemCount);
      } else {
        this.paginationNotification = '';
      }
      if (this.columns !== undefined && this.sortBy !== undefined) {
        const col = this.columns.toArray().find(column => column.property === this.sortBy) as DataTableColumnDirective;
        this.sortNotification = (this.sortAsc ? this.labels.sortedAscending : this.labels.sortedDescending)
          .replace('{title}', this.title)
          .replace('{header}', col.header);
      } else {
        this.sortNotification = '';
      }
    }
  }

  ngOnDestroy() {
    this.subject$.unsubscribe();
    this.notifier$.unsubscribe();
  }
}
