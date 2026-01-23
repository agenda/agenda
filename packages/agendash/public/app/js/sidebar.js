const sidebar = Vue.component("sidebar", {
  props: ["overview", "pagesize", "loading"],
  computed: {
    sortedArray() {
      function compare(a, b) {
        let displayNameA = a.displayName.toLowerCase();
        let displayNameB = b.displayName.toLowerCase();
        if (displayNameA === "all jobs" || displayNameB === "all jobs") return;
        if (displayNameA < displayNameB) return -1;
        if (displayNameA > displayNameB) return 1;
        return 0;
      }

      return this.overview.sort(compare);
    },
  },
  methods: {
    flexgrow(number) {
      return Math.log2(1 + number);
    },
    searchSpecificJob(job, type) {
      if (job === "All Jobs") {
        if (type) {
          this.$emit(
            "search-sidebar",
            "",
            "",
            "",
            this.pagesize,
            "",
            "",
            type,
            ""
          );
        } else {
          this.$emit(
            "search-sidebar",
            "",
            "",
            "",
            this.pagesize,
            "",
            "",
            "",
            ""
          );
        }
      } else if (type) {
        this.$emit(
          "search-sidebar",
          job,
          "",
          "",
          this.pagesize,
          "",
          "",
          type,
          ""
        );
      } else {
        this.$emit("search-sidebar", job, "", "", this.pagesize, "", "", "");
      }
    },
  },
  template: `
    <div class="col sidebar pt-4">
      <div class="row">
        <div class="col ">
           <button data-toggle="modal" data-target="#modalNewJob" @click="$emit('new-job')" data-placement="top" title="Add a new job" class="btn btn-block btn-outline-success"><i class="oi oi-plus IcoInButton"></i> New Job</button>
        </div>
      </div> <!-- row -->
      <div  class="row p-0">
        <div  v-if="loading" class="col-12 my-5 ml-auto text-center">
            <div class="text-center my-5 py-5">
              <div class="spinner-border" role="status">
                            </div>
                            <div>
                              <span class="">Loading Jobs...</span>
                            </div>
              </div>
        </div>
        <div v-else class="col">
          <div class="row rows-ow" v-for="type in sortedArray">
            <div class="col-12 d-flex mt-4 mybtn" @click="searchSpecificJob(type.displayName,'')">
              <div class="mr-auto">{{type.displayName}}</div><div class="text-rigth pill-big-own bg-secondary right">{{type.total}}</div>
            </div>
            <div class="col-12 p-1">
              <div class="progress">
                <div class="progress-bar progress-bar-striped progress-bar-info bg-info" role="progressbar" :style="{'flex-grow': flexgrow(type.scheduled)}"></div>
                <div class="progress-bar progress-bar-striped progress-bar-primary bg-primary" role="progressbar" :style="{'flex-grow': flexgrow(type.queued)}"></div>
                <div class="progress-bar progress-bar-striped progress-bar-warning bg-warning" role="progressbar" :style="{'flex-grow': flexgrow(type.running)}"></div>
                <div class="progress-bar progress-bar-striped progress-bar-success bg-success" role="progressbar"  :style="{'flex-grow': flexgrow(type.completed)}"></div>
                <div class="progress-bar progress-bar-striped progress-bar-danger bg-danger" role="progressbar" :style="{'flex-grow': flexgrow(type.failed)}"></div>
              </div>
            </div>
             <!-- internal list of states  -->
            <div class="col-12 d-flex px-3 mb-2 mybtn" @click="searchSpecificJob(type.displayName,'scheduled')">
              <div class="mr-auto">Scheduled: </div><div class="text-rigth">{{type.scheduled}}</div>
            </div>
            <div class="col-12 d-flex px-3 mb-2 text-primary mybtn" @click="searchSpecificJob(type.displayName,'queued')">
              <div class="mr-auto">Queued: </div><div class="text-rigth">{{type.queued}}</div>
            </div>
            <div class="col-12 d-flex px-3 mb-2 text-warning mybtn"  @click="searchSpecificJob(type.displayName,'running')">
              <div class="mr-auto">Running: </div><div class="text-rigth">{{type.running}}</div>
            </div>
            <div class="col-12 d-flex px-3 mb-2 text-success mybtn"  @click="searchSpecificJob(type.displayName,'completed')">
              <div class="mr-auto">Completed: </div><div class="text-rigth">{{type.completed}}</div>
            </div>
            <div class="col-12 d-flex px-3 mb-2 text-danger mybtn"  @click="searchSpecificJob(type.displayName,'failed')">
              <div class="mr-auto">Failed: </div><div class="text-rigth">{{type.failed}}</div>
            </div>
            <div class="col-12 d-flex px-3 mb-2 text-info mybtn"  @click="searchSpecificJob(type.displayName,'repeating')">
              <div class="mr-auto">Repeating: </div><div class="text-rigth">{{type.repeating}}</div>
            </div>

          </div>
        </div>
      </div> <!-- row -->
    </div> <!-- div -->
  `,
});
