const jobDetail = Vue.component("job-detail", {
  props: ["job"],
  filters: {
    formatJSON(jsonstr) {
      return JSON.stringify(jsonstr, null, 2);
    },
  },
  methods: {
    formatDate(date) {
      return moment(date).format("DD-MM-YYYY HH:mm:ss");
    },
  },
  template: `
  <div class="modal fade" id="modalData" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
      <!-- Modal -->
    <div class="modal-dialog job-detail-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="exampleModalLabel">Job Data - {{job.job.name}}</h5>
          <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body">
        <div class="row my-3">
          <div class="col">
            <p><strong>Next run starts: </strong>{{ formatDate(job.job.nextRunAt) }}</p>
            <p><strong>Last run started: </strong>{{ formatDate(job.job.lastRunAt) }}</p>
          </div>
        </div>
        <p><strong>Metadata: </strong></p>
        <prism-editor class="json-editor" :lineNumbers="true" :readonly="true" :code="job.job.data | formatJSON" language="json"></prism-editor>
        <div v-if='job.failed' class="row mt-3">
          <div class="col pt-3 bg-danger text-light">
              <p><strong>Fail Count:</strong> {{job.job.failCount}}</p>
              <p><strong>Failed At:</strong> {{formatDate(job.job.failedAt)}}</p>
              <p><strong>Reason:</strong> {{job.job.failReason}}</p>
          </div>
        </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
        </div>
      </div>
    </div>
  </div>
  `,
});
