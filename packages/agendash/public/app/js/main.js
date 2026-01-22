const app = Vue.component("app", {
  data: () => ({
    jobs: [],
    overview: [],
    refresh: 30,
    showDetail: false,
    pagenumber: 1,
    totalPages: 0,
    showConfirm: false,
    showConfirmMulti: false,
    showConfirmRequeue: false,
    showConfirmRequeueMulti: false,
    showNewJob: false,
    jobData: {},
    deletec: false,
    requeuec: false,
    pagesize: 50,
    sendClean: false,
    createc: false,
    property: "",
    search: "",
    object: "",
    newLimit: null,
    skip: 0,
    name: "",
    state: "",
    nameprop: "",
    loading: false,
    hideSlide: true,
  }),
  methods: {
    openNav() {
      document.getElementById("mySidebar").style.width = "100%";
      document.getElementById("main").style.marginLeft = "100%";
      this.hideSlide = false;
    },
    closeNav() {
      document.getElementById("mySidebar").style.width = "0";
      document.getElementById("main").style.marginLeft = "0";
      this.hideSlide = true;
    },
    showJobDetail(data) {
      this.jobData = data;
      this.showDetail = true;
    },
    readyClean() {
      this.sendClean = true;
    },
    confirmDelete(data) {
      this.jobData = data;
      this.showConfirm = true;
    },
    confirmDeleteMulti(data) {
      this.jobData = data;
      this.showConfirmMulti = true;
    },
    confirmRequeue(data) {
      this.jobData = data;
      this.showConfirmRequeue = true;
    },
    confirmRequeueMulti(data) {
      this.jobData = data;
      this.showConfirmRequeueMulti = true;
    },
    newJob(data) {
      this.jobData = data;
      this.showNewJob = true;
    },
    searchForm(name, search, property, limit, skip, refresh, state, object) {
      this.pagesize = limit ? limit : this.pagesize
        this.name = name
        this.search = search
        this.property = property
        this.skip = skip
        this.refresh = refresh
        this.state = state
        this.object = object ? object : this.object

        // Form changed, reset the pagination state
        this.pagenumber = 1
        this.totalPages = 1

        this.fetchData(
          this.name,
          this.search,
          this.property,
          this.pagesize,
          this.skip,
          this.refresh,
          this.state,
          this.object
        );
    },
    refreshData() {
      this.fetchData(
        this.name,
        this.search,
        this.property,
        this.pagesize,
        this.skip,
        this.refresh,
        this.state,
        this.object
      );
    },
    pagechange(action) {
      if (action === "next") {
        this.pagenumber++;
      }
      if (action === "prev") {
        this.pagenumber--;
      }
      this.skip = (this.pagenumber - 1) * this.pagesize;
      this.fetchData(
        this.name,
        this.search,
        this.property,
        this.pagesize,
        this.skip,
        this.refresh,
        this.state,
        this.object
      );
    },
    fetchData(
      name = "",
      search = "",
      property = "",
      limit = 50,
      skip = 0,
      refresh = 30,
      state = "",
      object
    ) {
      this.loading = true;
      this.pagesize = this.pagesize === 0 ? parseInt(limit) : this.pagesize;
      this.refresh = parseFloat(refresh);
      const url = `api?limit=${limit}&job=${name}&skip=${skip}&property=${property}${
        object ? "&isObjectId=true" : ""
      }${state ? `&state=${state}` : ""}&q=${search}`;
      return axios
        .get(url)
        .then((result) => result.data)
        .then(
          (data) => {
            this.jobs = data.jobs;
            this.search = search;
            this.property = property;
            this.object = object;
            this.overview = data.overview;
            this.loading = false;
            this.totalPages = data.totalPages;
          },
          () => {
            this.loading = false;
            this.jobs = [];
          }
        )
        .catch(console.log);
    },

    popupmessage(data) {
      if (data === "delete") {
        this.deletec = true;
        setTimeout(() => {
          this.deletec = false;
        }, 2000);
      }
      if (data === "multidelete") {
        this.deletec = true;
        setTimeout(() => {
          this.deletec = false;
        }, 2000);
      }
      if (data === "requeue") {
        this.requeuec = true;
        setTimeout(() => {
          this.requeuec = false;
        }, 2000);
      }
      if (data === "multirequeue") {
        this.requeuec = true;
        setTimeout(() => {
          this.requeuec = false;
        }, 2000);
      }
      if (data === "create") {
        this.createc = true;
        setTimeout(() => {
          this.createc = false;
        }, 2000);
      }
    },
  },
  created() {
    return this.fetchData();
  },
  template: `

    <div class="container-fluid">
      <div class="">
        <div class="navbar navbar-dark fixed-top bg-dark flex-md-nowrap p-0 shadow">
          <div class="d-flex">
            <div>
              <a class="navbar-brand col-sm-10 col-md-10 mr-0 tittle"> Agendash</a>
            </div>
            <div class='d-md-none w-50'>
              <div id="mySidebar" class="sidebar-collapse" @click="closeNav()">
                <a href="javascript:void(0)" class="closebtn" @click="closeNav()">&times;</a>
                <div v-if="hideSlide === false" class="bg-light overflow-auto">
                  <sidebar
                    v-on:search-sidebar="searchForm"
                    v-on:new-job="newJob"
                    :overview="overview"
                    :pagesize="pagesize"
                    :loading="loading"
                    >
                  </sidebar>
                </div>
              </div>
              <div class="slidebar-container-button" id="main">
                <button class="openbtn" @click="openNav()">&#9776;</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="row pt-5">
          <div v-if="hideSlide === true" class="col-md-2 d-none d-md-block bg-light overflow-auto">
            <sidebar
              v-on:search-sidebar="searchForm"
              v-on:new-job="newJob"
              :overview="overview"
              :pagesize="pagesize"
              :loading="loading"
              >
            </sidebar>
          </div>
          <main role="main" class="col-md-10 ml-sm-auto col-lg-10 px-4 pt-3 pb-5">
            <div class="col-12">
              <topbar v-on:search-form="searchForm"
              :name='name'
              :state='state'
              :search='search'
              :property='property'
              >
              </topbar>
            </div>
            <div class="col-12 ">
              <job-list
                  v-on:confirm-delete="confirmDelete"
                  v-on:confirm-multi-delete="confirmDeleteMulti"
                  v-on:confirm-requeue="confirmRequeue"
                  v-on:confirm-multi-requeue="confirmRequeueMulti"
                  v-on:show-job-detail="showJobDetail"
                  v-on:pagechange="pagechange"
                  :pagesize="pagesize"
                  :pagenumber='pagenumber'
                  :totalPages='totalPages'
                  :skip="skip"
                  :jobs="jobs"
                  :sendClean='sendClean'
                  :loading='loading'
                  >
              </job-list>
            </div>
          </main>
      </div>
      <div class="row bg-dark py-3">
        <div class="col-6 m-auto text-light text-center">
          <small>UI written by <a class="text-light" href="https://www.softwareontheroad.com/about" target="_BLANK">Sam Quinn</a>. Backend by Agenda team.</small>
        </div>
      </div>
      <job-detail v-if="showDetail" v-bind:job="jobData"></job-detail>
      <confirm-delete v-if="showConfirm" v-on:popup-message="popupmessage('delete')" v-on:refresh-data="refreshData" v-bind:job="jobData"></confirm-delete>
      <confirm-multi-delete v-if="showConfirmMulti" v-on:ready-clean="readyClean" v-on:popup-message="popupmessage('multidelete')" v-on:refresh-data="refreshData" v-bind:jobs="jobData"></confirm-multi-delete>
      <confirm-requeue v-if="showConfirmRequeue"  v-on:popup-message="popupmessage('requeue')" v-on:refresh-data="refreshData" v-bind:job="jobData"></confirm-requeue>
      <confirm-multi-requeue v-if="showConfirmRequeueMulti" v-on:ready-clean="readyClean" v-on:popup-message="popupmessage('multirequeue')" v-on:refresh-data="refreshData" v-bind:jobs="jobData"></confirm-multi-requeue>
      <popup-message :deletec="deletec" :requeuec="requeuec" :createc="createc"></popup-message>
      <new-job v-if="showNewJob" v-on:popup-message="popupmessage('create')" v-on:refresh-data="fetchData"></new-job>
  </div>
  `,
});
