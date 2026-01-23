const jobList = Vue.component("job-list", {
  data: () => ({
    multijobs: [],
    currentSort: "name",
    currentSortDir: "asc",
  }),
  props: ["jobs", "pagesize", "pagenumber", "totalPages", "sendClean", "loading"],
  computed: {
    sortedJobs: function () {
      var sortedJobs = this.jobs.sort((a, b) => {
        let displayA, displayB;
        if (this.currentSort === "name") {
          displayA = a.job[this.currentSort]
            ? a.job[this.currentSort].toLowerCase()
            : "";
          displayB = a.job[this.currentSort]
            ? b.job[this.currentSort].toLowerCase()
            : "";
        } else {
          displayA = moment(a.job[this.currentSort]);
          displayB = moment(b.job[this.currentSort]);
        }
        let modifier = 1;
        if (this.currentSortDir === "desc") modifier = -1;
        if (displayA < displayB) return -1 * modifier;
        if (displayA > displayB) return 1 * modifier;
        return 0;
      });

      /** Show recurring jobs first */
      return Array.prototype.concat(
        sortedJobs.filter(job => job.repeating === true),
        sortedJobs.filter(job => job.repeating === false),
      )
    },
  },
  watch: {
    jobs() {
      // reset multijobs when jobs have changed
      this.multijobs = [];
    },
  },
  methods: {
    sort(s) {
      //if s == current sort, reverse
      if (s === this.currentSort) {
        this.currentSortDir = this.currentSortDir === "asc" ? "desc" : "asc";
      }
      this.currentSort = s;
    },
    sendQueued() {
      this.$emit("confirm-multi-requeue", this.multijobs);
      // this.multijobs = []
    },
    sendDelete() {
      this.$emit("confirm-multi-delete", this.multijobs);
      // this.multijobs = []
    },
    cleanMulti() {
      return console.log("received Clean Multi");
    },
    formatTitle(date) {
      if (!date) return;
      return moment(date).format();
    },
    formatDate(date) {
      if (!date) return;
      return moment(date).fromNow();
    },
    checkAllCheckboxes() {
      const checkboxes = document.querySelectorAll(".checkbox-triggerable");
      for (const checkbox of checkboxes) {
        checkbox.click();
      }
    },
    toggleList(job) {
      if (this.multijobs.includes(job.job._id)) {
        this.multijobs.splice(this.multijobs.indexOf(job.job._id), 1);
      } else {
        this.multijobs.push(job.job._id);
      }
    },
  },
  template: `<div v-on:sendClean="cleanMulti"><div><div class="d-flex justify-content-end mb-2"><span class="mr-2">{{ multijobs.length }} jobs selected</span><button :disabled="!multijobs.length" data-toggle="modal" data-target="#modalRequeueSureMulti" @click="sendQueued" class="btn btn-primary mr-2" data-placement="top" title="Requeue list of selecteds Jobs"> Multiple Requeue </button><button :disabled="!multijobs.length" data-toggle="modal" data-target="#modalDeleteSureMulti" @click="sendDelete" class="btn btn-danger" data-placement="top" title="Delete list of selecteds Jobs"> Multiple Delete </button></div></div><table class="table table-striped d-none d-xl-table"><thead class="thead-dark"><tr><th @click="checkAllCheckboxes()" scope="col"> Multi </th><th @click="sort('status')" scope="col"> Status </th><th @click="sort('name')" scope="col"> Name <i v-if="currentSort === 'name' && currentSortDir === 'asc'" class="material-icons sortable" title="Sort Z to A">arrow_drop_down</i><i v-else-if="currentSort === 'name' && currentSortDir === 'desc'" class="material-icons sortable" title="Sort A to Z">arrow_drop_up</i><i v-else class="material-icons sortableinactive" title="Sort A to Z">arrow_drop_down</i></th><th @click="sort('lastRunAt')" scope="col"> Last run started <i v-if="currentSort === 'lastRunAt' && currentSortDir === 'asc'" class="material-icons sortable" title="Sort Z to A">arrow_drop_up</i><i v-else-if="currentSort === 'lastRunAt' && currentSortDir === 'desc'" class="material-icons sortable" title="Sort A to Z">arrow_drop_down</i><i v-else class="material-icons sortableinactive" title="Sort A to Z">arrow_drop_down</i></th><th @click="sort('nextRunAt')" scope="col"> Next run starts<i v-if="currentSort === 'nextRunAt' && currentSortDir === 'asc'" class="material-icons sortable" title="Sort Z to A">arrow_drop_up</i><i v-else-if="currentSort === 'nextRunAt' && currentSortDir === 'desc'" class="material-icons sortable" title="Sort A to Z">arrow_drop_down</i><i v-else class="material-icons sortableinactive" title="Sort A to Z">arrow_drop_down</i></th><th @click="sort('lastFinishedAt')" scope="col"> Last finished<i v-if="currentSort === 'lastFinishedAt' && currentSortDir === 'asc'" class="material-icons sortable" title="Sort Z to A">arrow_drop_up</i><i v-else-if="currentSort === 'lastFinishedAt' && currentSortDir === 'desc'" class="material-icons sortable" title="Sort A to Z">arrow_drop_down</i><i v-else class="material-icons sortableinactive" title="Sort A to Z">arrow_drop_down</i></th><th scope="col"> Locked </th><th scope="col"> Actions </th></tr></thead><tbody v-if="loading"><tr><td colspan='10' scope="row"><div class="col-12 my-5 ml-auto text-center"><div class="text-center my-5 py-5"><div class="spinner-border" role="status"></div><div><span class="">Loading Jobs...</span></div></div></div></td></tr></tbody><tbody v-else><tr v-for="job in sortedJobs"><td width="10" class="mult-select"><input v-model="multijobs" :id='job.job._id' class="checkbox-triggerable" type="checkbox" :value="job.job._id"></input></td><td th scope="row" class="job-name"><i v-if="job.repeating" class="oi oi-timer pill-own bg-info"><span>{{job.job.repeatInterval}}</span></i><i v-if="job.scheduled" class="pill-own bg-info pill-withoutIcon"><span>Scheduled</span></i><i v-if="job.completed" class="pill-own bg-success pill-withoutIcon"><span>Completed</span></i><i v-if="job.queued" class="pill-own bg-primary pill-withoutIcon"><span>Queued</span></i><i v-if="job.failed" class="pill-own bg-danger pill-withoutIcon"><span>Failed</span></i><i v-if="job.running" class="pill-own bg-warning pill-withoutIcon"><span>Running</span></i></td><td class="job-name" @click="toggleList(job)"> {{job.job.name}} </td><td class="job-lastRunAt" :title="formatTitle(job.job.lastRunAt)" @click="toggleList(job)"> {{ formatDate(job.job.lastRunAt) }} </td><td class="job-nextRunAt" :title="formatTitle(job.job.nextRunAt)" @click="toggleList(job)"> {{ formatDate(job.job.nextRunAt) }} </td><td class="job-finishedAt" :title="formatTitle(job.job.lastFinishedAt)" @click="toggleList(job)"> {{ formatDate(job.job.lastFinishedAt) }} </td><td class="job-lockedAt" :title="formatTitle(job.job.lockedAt)" @click="toggleList(job)"> {{ formatDate(job.job.lockedAt) }} </td><td class="job-actions"><i class="material-icons md-dark md-custom action-btn viewData text-primary" data-toggle="modal" data-target="#modalRequeueSure" @click="$emit('confirm-requeue', job)" data-placement="left" title="Requeue">update</i><i class="material-icons md-dark md-custom action-btn viewData text-success" data-toggle="modal" data-target="#modalData" @click="$emit('show-job-detail', job)" data-placement="top" title="Job Data">visibility</i><i class="material-icons md-dark md-custom action-btn viewData text-danger" data-toggle="modal" data-target="#modalDeleteSure" @click="$emit('confirm-delete', job)" data-placement="top" title="Delete permanently">delete_forever</i></td></tr></tbody></table><div class="d-xl-none"><div class="row"><div v-for="job in sortedJobs" class="col col-xs-6 order-1 p-1"><div class="card bg-light"><div class="card-header card-responsive-title-container"><div class="card-responsive-name" @click="toggleList(job)">{{job.job.name}}</div><div class="d-flex align-items-center"><div class="card-responsive-status-title mr-2" style="font-size: 18px; display: flex; align-items: center"><input v-model="multijobs" :id='job.job._id' type="checkbox" :value="job.job._id" class="card-responsive-checkbox"></input></div><i class="material-icons md-dark md-custom action-btn viewData text-primary material-icons-size mr-1" data-toggle="modal" data-target="#modalRequeueSure" @click="$emit('confirm-requeue', job)" data-placement="left" title="Requeue">update</i><i class="material-icons md-dark md-custom action-btn viewData text-success material-icons-size mr-1" data-toggle="modal" data-target="#modalData" @click="$emit('show-job-detail', job)" data-placement="top" title="Job Data">visibility</i><i class="material-icons md-dark md-custom action-btn viewData text-danger material-icons-size" data-toggle="modal" data-target="#modalDeleteSure" @click="$emit('confirm-delete', job)" data-placement="top" title="Delete permanently">delete_forever</i></div></div><div class="card-body"><div class="d-flex justify-content-center mb-2"><i v-if="job.repeating" class="oi oi-timer pill-own mr-2 bg-info pill-own-card"><span class="pill-own-card-info">{{job.job.repeatInterval}}</span></i><i v-if="job.scheduled" class="pill-own mr-2 bg-info pill-withoutIcon pill-own-card"><span class="pill-own-card-info">Scheduled</span></i><i v-if="job.completed" class="pill-own mr-2 bg-success pill-withoutIcon pill-own-card"><span class="pill-own-card-info">Completed</span></i><i v-if="job.queued" class="pill-own mr-2 bg-primary pill-withoutIcon pill-own-card"><span class="pill-own-card-info">Queued</span></i><i v-if="job.failed" class="pill-own mr-2 bg-danger pill-withoutIcon pill-own-card"><span class="pill-own-card-info">Failed</span></i><i v-if="job.running" class="pill-own mr-2 bg-warning pill-withoutIcon pill-own-card"><span class="pill-own-card-info">Running</span></i></div><div class="row"><div class="col col-md-6 text-center"><div class="card-responsive-status-title">Last run started</div><div class="mb-3" :title="formatTitle(job.job.lastRunAt)">{{ formatDate(job.job.lastRunAt) }}</div><div class="card-responsive-status-title">Last finished</div><div :title="formatTitle(job.job.lastFinishedAt)">{{ formatDate(job.job.lastFinishedAt) }}</div></div><div class="col col-md-6 text-center"><div class="card-responsive-status-title">Next run starts</div><div class="mb-3" :title="formatTitle(job.job.nextRunAt)">{{ formatDate(job.job.nextRunAt) }}</div><div class="card-responsive-status-title">Locked</div><div :title="formatTitle(job.job.lockedAt)">{{ formatDate(job.job.lockedAt) || "-" }}</div></div></div><div></div></div></div></div></div></div><div class="row"><div class="col d-flex justify-content-center"><nav aria-label="Page navigation example"><ul class="pagination"><li class="page-item" :class="pagenumber === 1 ? 'disabled': ''"><a class="page-link" @click="$emit('pagechange', 'prev')">Previous</a></li><li class="page-item" :class="pagenumber >= totalPages ? 'disabled': ''"> <a style="cursor:pointer;" class="page-link" @click="$emit('pagechange', 'next')">Next</a> </li></ul></nav></div></div><div class="row"><div class="col d-flex justify-content-center">Page: {{pagenumber}} / {{totalPages}}</div></div></div>`,
});
