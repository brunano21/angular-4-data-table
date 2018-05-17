import {
  Component,
  ElementRef,
  forwardRef,
  Inject,
  Input,
  ViewChild
} from '@angular/core';
import { DataTableComponent} from '../table/table.component';

let nextId = 0;

@Component({
  selector: 'data-table-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.css']
})
export class DataTablePaginationComponent {

  id = `pagination-${nextId++}`;

  @ViewChild('pageInput') pageInput: ElementRef;

  @Input() limits: number[];

  constructor(@Inject(forwardRef(() => DataTableComponent)) public dataTable: DataTableComponent) {
  }

  pageBack() {
    this.dataTable.offset -= Math.min(this.dataTable.limit, this.dataTable.offset);
    if (this.dataTable.offset <= 0) {
      this.pageInput.nativeElement.focus();
    }
}
  pageForward() {
    this.dataTable.offset += this.dataTable.limit;
    if ((this.dataTable.offset + this.dataTable.limit) >= this.dataTable.itemCount) {
      this.pageInput.nativeElement.focus();
    }
  }

  pageFirst() {
    this.dataTable.offset = 0;
    this.pageInput.nativeElement.focus();
  }

  pageLast() {
    this.dataTable.offset = (this.maxPage - 1) * this.dataTable.limit;
    if ((this.dataTable.offset + this.dataTable.limit) >= this.dataTable.itemCount) {
      this.pageInput.nativeElement.focus();
    }
  }

  get maxPage() {
    return Math.ceil(this.dataTable.itemCount / this.dataTable.limit);
  }

  get limit() {
    return this.dataTable.limit;
  }

  set limit(value) {
    this.dataTable.limit = +value;
    // returning back to the first page.
    this.page = 1;
  }

  get page() {
    return this.dataTable.page;
  }

  set page(value) {
    this.dataTable.page = +value;
  }

  validate(event) {
    const newValue = +event.target.value;
    if (newValue !== this.page) {
      this.page = (event.target.value > this.maxPage) ? this.maxPage : (newValue < 1 ) ? 1 : newValue;
      event.target.value = this.page;
    }
  }

  get paginationText(): string {
    const ceil = Math.ceil(this.dataTable.itemCount / this.dataTable.limit);
    return this.dataTable.labels.paginationText
    .replace('{from}', ceil !== 0 ? String(this.dataTable.offset + 1) : '0')
    .replace('{to}', String(Math.min(this.dataTable.offset + this.dataTable.limit, this.dataTable.itemCount)))
    .replace('{total}', String(this.dataTable.itemCount));
  }
}
